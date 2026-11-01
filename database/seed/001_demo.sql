INSERT INTO stations(id,name,location_code,online) VALUES ('STN-01','GreenRoute Central','BLR-01',true) ON CONFLICT DO NOTHING;
INSERT INTO chargers(id,station_id,connector,max_power_kw,power_source,status,ocpp_identity) VALUES
('A1','STN-01','CCS2',150,'solar-grid','available','CHARGER-A1'),
('A2','STN-01','CCS2',60,'grid','available','CHARGER-A2'),
('B1','STN-01','Type 2',22,'solar','available','CHARGER-B1'),
('B2','STN-01','CHAdeMO',50,'grid','available','CHARGER-B2') ON CONFLICT DO NOTHING;
INSERT INTO tariffs(station_id,rate_per_kwh,solar_discount_percent,valid_from) SELECT 'STN-01',18,15,now() WHERE NOT EXISTS(SELECT 1 FROM tariffs WHERE station_id='STN-01');
