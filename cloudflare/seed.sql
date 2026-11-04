INSERT INTO tracks (id,title,artist,album,genre,duration,object_key,source_url,mime_type,cover_url,license,attribution)
VALUES
('11111111-1111-4111-8111-111111111111','Ode to Joy','Ludwig van Beethoven','Public-domain test recordings','Classical',39,NULL,'https://upload.wikimedia.org/wikipedia/commons/f/f7/Ode_to_Joy.ogg','audio/ogg','','Public Domain Mark 1.0','Beethoven; recording converted by Raul654'),
('22222222-2222-4222-8222-222222222222','Für Elise','Ludwig van Beethoven','Public-domain test recordings','Classical',0,NULL,'https://upload.wikimedia.org/wikipedia/commons/7/7b/FurElise.ogg','audio/ogg','','Public Domain','Performance by V Gao (Gaodifan)')
ON CONFLICT(id) DO NOTHING;
