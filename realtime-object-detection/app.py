import os
import threading
import cv2
import numpy as np
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
CFG = os.path.join(MODEL_DIR, "yolov4-tiny.cfg")
WEIGHTS = os.path.join(MODEL_DIR, "yolov4-tiny.weights")
NAMES = os.path.join(MODEL_DIR, "coco.names")
net = None
classes = []
output_layers = []
model_lock = threading.Lock()


def load_model():
    global net, classes, output_layers
    with model_lock:
        if net is not None:
            return
        if not all(os.path.exists(p) for p in (CFG, WEIGHTS, NAMES)):
            raise RuntimeError("YOLO model files are missing")
        with open(NAMES, encoding="utf-8") as f:
            classes = [x.strip() for x in f if x.strip()]
        net = cv2.dnn.readNetFromDarknet(CFG, WEIGHTS)
        # Use OpenCV's name-based API. This avoids the OpenCV 4.14
        # FIXED_TYPE assertion caused by layer-index handling.
        output_layers = list(net.getUnconnectedOutLayersNames())
        if not output_layers:
            raise RuntimeError("YOLO output layers could not be detected")


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/health")
def health():
    try:
        load_model()
        return jsonify(ok=True, status="ok", model="yolov4-tiny", layers=len(output_layers))
    except Exception as exc:
        app.logger.exception("Health/model error")
        return jsonify(ok=False, status="error", error=f"{type(exc).__name__}: {exc}"), 500


@app.post("/detect")
def detect():
    try:
        load_model()
        if "image" not in request.files:
            return jsonify(ok=False, error="No image supplied"), 400

        raw = request.files["image"].read()
        image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            return jsonify(ok=False, error="Invalid image"), 400

        if image.shape[1] > 640:
            scale = 640.0 / image.shape[1]
            image = cv2.resize(image, (640, max(1, int(image.shape[0] * scale))))

        h, w = image.shape[:2]
        blob = cv2.dnn.blobFromImage(
            image, scalefactor=1.0 / 255.0, size=(416, 416),
            mean=(0, 0, 0), swapRB=True, crop=False
        )

        # Net is stateful; serialize inference across Gunicorn threads.
        with model_lock:
            net.setInput(blob)
            outputs = net.forward(output_layers)

        boxes, confidences, class_ids = [], [], []
        scale_vec = np.array([w, h, w, h], dtype=np.float32)
        for output in outputs:
            for detection in output:
                scores = detection[5:]
                class_id = int(np.argmax(scores))
                confidence = float(scores[class_id])
                if confidence < 0.35:
                    continue
                cx, cy, bw, bh = detection[:4].astype(np.float32) * scale_vec
                boxes.append([
                    int(cx - bw / 2), int(cy - bh / 2),
                    int(bw), int(bh)
                ])
                confidences.append(confidence)
                class_ids.append(class_id)

        indices = cv2.dnn.NMSBoxes(boxes, confidences, 0.35, 0.40)
        detections = []
        for idx in np.asarray(indices).reshape(-1) if len(indices) else []:
            idx = int(idx)
            x, y, bw, bh = boxes[idx]
            detections.append({
                "label": classes[class_ids[idx]],
                "confidence": round(confidences[idx], 3),
                "x": max(0, x),
                "y": max(0, y),
                "width": max(0, bw),
                "height": max(0, bh),
            })

        return jsonify(ok=True, width=w, height=h, detections=detections)

    except Exception as exc:
        app.logger.exception("Detection error")
        return jsonify(
            ok=False,
            error=f"Detection server error: {type(exc).__name__}: {exc}"
        ), 500


@app.errorhandler(Exception)
def handle_exception(exc):
    app.logger.exception("Unhandled Flask exception")
    return jsonify(ok=False, error=f"Server error: {type(exc).__name__}: {exc}"), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, threaded=True)
