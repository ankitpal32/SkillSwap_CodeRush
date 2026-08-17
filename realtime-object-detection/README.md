# Real-Time Object Detection

Flask + OpenCV DNN + YOLOv4-tiny browser webcam application.

## Run

```bash
pip install -r requirements.txt
python download_model.py
gunicorn app:app
```

Open the site and allow camera access. Detection runs through the Flask `/detect` endpoint.
