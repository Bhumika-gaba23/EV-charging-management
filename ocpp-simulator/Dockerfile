FROM python:3.13-alpine
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY simulator.py customer_simulator.py ./
CMD ["python", "customer_simulator.py"]
