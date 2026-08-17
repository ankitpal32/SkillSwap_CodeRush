import os
import urllib.request
BASE=os.path.join(os.path.dirname(__file__),'models');os.makedirs(BASE,exist_ok=True)
files={'yolov4-tiny.cfg':'https://raw.githubusercontent.com/AlexeyAB/darknet/master/cfg/yolov4-tiny.cfg','yolov4-tiny.weights':'https://github.com/AlexeyAB/darknet/releases/download/yolov4/yolov4-tiny.weights','coco.names':'https://raw.githubusercontent.com/pjreddie/darknet/master/data/coco.names'}
for name,url in files.items():
 p=os.path.join(BASE,name)
 if not os.path.exists(p) or os.path.getsize(p)<1000:
  print('Downloading',name);urllib.request.urlretrieve(url,p)
print('Model files ready')
