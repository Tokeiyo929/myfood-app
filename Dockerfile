FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY index.html style.css app.js server.py config.json favicon.svg manifest.webmanifest ./

EXPOSE 80

CMD ["python", "server.py"]
