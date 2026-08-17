import os
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

def load_model():
    global net, classes, output_layers
    if net is not None:
        return
    if not all(os.path.exists(p) for p in (CFG, WEIGHTS, NAMES)):
        raise RuntimeError("YOLO model files are missing")
    with open(NAMES, encoding="utf-8") as f:
        classes = [x.strip() for x in f if x.strip()]
    net = cv2.dnn.readNetFromDarknet(CFG, WEIGHTS)
    layer_names = net.getLayerNames()
    out = np.asarray(net.getUnconnectedOutLayers()).flatten()
    output_layers = [layer_names[int(i) - 1] for i in out]

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/health")
def health():
    try:
        load_model()
        return jsonify(status="ok", model="yolov4-tiny")
    except Exception as exc:
        return jsonify(status="error", error=str(exc)), 500

@app.post("/detect")
def detect():
    load_model()
    if "image" not in request.files:
        return jsonify(error="No image supplied"), 400
    raw = request.files["image"].read()
    image = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        return jsonify(error="Invalid image"), 400
    if image.shape[1] > 640:
        scale = 640 / image.shape[1]
        image = cv2.resize(image, (640, int(image.shape[0] * scale)))
    h, w = image.shape[:2]
    blob = cv2.dnn.blobFromImage(image, 1 / 255.0, (416, 416), swapRB=True, crop=False)
    net.setInput(blob)
    outputs = net.forward(output_layers)
    boxes, confidences, class_ids = [], [], []
    for output in outputs:
        for detection in output:
            scores = detection[5:]
            class_id = int(np.argmax(scores))
            confidence = float(scores[class_id])
            if confidence >= 0.35:
                cx, cy, bw, bh = detection[:4] * np.array([w, h, w, h])
                boxes.append([int(cx - bw/2), int(cy - bh/2), int(bw), int(bh)])
                confidences.append(confidence)
                class_ids.append(class_id)
    indices = cv2.dnn.NMSBoxes(boxes, confidences, 0.35, 0.40)
    detections = []
    if len(indices):
        for idx in np.asarray(indices).flatten():
            idx = int(idx)
            x, y, bw, bh = boxes[idx]
            detections.append({"label": classes[class_ids[idx]], "confidence": round(confidences[idx], 3), "x": max(0,x), "y": max(0,y), "width": max(0,bw), "height": max(0,bh)})
    return jsonify(width=w, height=h, detections=detections)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, threaded=True)
