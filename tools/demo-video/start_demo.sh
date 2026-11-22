#!/bin/sh
# Runs inside the pluggo-test image: C++ API (clock mode, open to the host), OCPP gateway, no simulator.
export CHARGEFLOW_PORT=18080 CHARGEFLOW_BIND_ADDRESS=0.0.0.0 CHARGEFLOW_SIMULATION_MODE=clock CHARGEFLOW_SIMULATION_SPEED=20
export CHARGEFLOW_SIMULATOR_KEY=demo-key CHARGEFLOW_CUSTOMER_DB=/tmp/demo.sqlite3 CHARGEFLOW_COOKIE_SECURE=0
export PLUGGO_REAL_CONNECTORS=MH-01 PLUGGO_OCPP_PORT=9016
export PLUGGO_CUSTOMER_API=http://127.0.0.1:18080 PLUGGO_CUSTOMER_WS=ws://127.0.0.1:18080/ocpp/customer
export PLUGGO_OCPP_CHARGERS='{"DEMO-MH-01":{"password":"demo-charger-password-01","connectors":{"1":"MH-01"}}}'
/app/ev_web_api &
sleep 2
/app/venv/bin/python /app/gateway.py &
wait
