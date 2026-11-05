-- Approved Red Oak catalog IDs only. No member certification is updated.
create temporary table certification_preservation_before on commit drop as
select 'member' as kind, id, to_jsonb(mc) as original from public.member_certifications mc
union all select 'requirement', id, to_jsonb(r) from public.role_required_certifications r
union all select 'other_catalog', id, to_jsonb(c) from public.certifications c
  where department_id <> '82f50d14-216a-4dd1-80f4-58459dc97b97';

create temporary table approved_certification_mapping (
  legacy_id uuid primary key, original_name text not null, standard_name text not null
) on commit drop;
insert into approved_certification_mapping values
('d0b59cbb-30a3-486c-9686-007acae1f723','Fire Apparatus Driver/Operator Pumper (2009 Edition)','Fire Apparatus Driver Operator Pumper'),
('ff4d94c4-3b2f-42f6-93f6-d66aab60d3fe','Fire Apparatus Driver/Operator Pumper (IFSAC 2003 Edition)','Fire Apparatus Driver Operator Pumper'),
('bc998e10-eec5-46d6-865e-d40080c532e4','Fire Fighter I (2008 Edition)','Firefighter 1'),
('0b821550-eb4d-4064-b6c4-bb5e4a12257b','Fire Fighter I (2019 Edition)','Firefighter 1'),
('e1963cae-5442-4595-9af8-d3f52e0d1047','Fire Fighter I (IFSAC 1992 Edition)','Firefighter 1'),
('182ffc8c-5512-4056-aba2-7ec9de4af5d6','Fire Fighter I (IFSAC 1997 Edition)','Firefighter 1'),
('7c91c6b6-9398-4027-8632-24a4e917191c','Fire Fighter I (IFSAC 2002 Edition)','Firefighter 1'),
('1f190aa6-d8de-416d-9731-d6a169d7a189','Fire Fighter I (IFSAC 2008 Edition)','Firefighter 1'),
('11088abe-dbba-4ad2-8e00-adccd5a6a2c1','Fire Fighter I (IFSAC 2013 Edition)','Firefighter 1'),
('57348a77-083d-4f6f-9f13-3ad86918d634','Fire Fighter I (Reciprocity)','Firefighter 1'),
('237359f7-9fac-4f83-af93-ceca3cc00132','Fire Fighter II (1010-2024)','Firefighter 2'),
('a2f9090f-1b82-4f96-8348-7213de45453d','Fire Fighter II (2008 Edition)','Firefighter 2'),
('11d5faa6-6f64-43f2-9651-031f51b985cc','Fire Fighter II (2019 Edition)','Firefighter 2'),
('9c24b5c5-3e19-498b-a4bf-b00b95bbabfb','Fire Fighter II (IFSAC 1992 Edition)','Firefighter 2'),
('0486c3ea-fb25-4c79-9506-931d1a6a500b','Fire Fighter II (IFSAC 1997 Edition)','Firefighter 2'),
('2151f6ff-974b-4928-8a80-876ba5fabf98','Fire Fighter II (IFSAC 2008 Edition)','Firefighter 2'),
('d2c9f193-c769-4a85-b0e3-7027d881d962','Fire Fighter II (Reciprocity)','Firefighter 2'),
('e77c12d4-5af6-4c67-af82-88d693a18675','Fire Inspector I (2009 Edition)','Fire Inspector 1'),
('22555ba1-95d3-48d5-a75f-96f4fe2c599b','Fire Inspector I (2014 Edition)','Fire Inspector 1'),
('848c75ce-282d-4693-b795-26249c4e6b6e','Fire Officer I (2020 Edition)','Fire Officer 1'),
('d2af4e17-de74-495c-bef4-39676da59ae5','Fire Officer I (IFSAC 2009 Edition)','Fire Officer 1'),
('96930831-8d39-4b5d-90d3-3f705a69baa5','Fire Officer II (1021-2020)','Fire Officer 2'),
('6216b7ca-80c8-4de5-9a2a-93279b0e8a00','Fire and Emergency Services Instructor I (1041-2019)','Fire and Emergency Services Instructor 1'),
('5ef0b6e4-542d-4720-8fd2-70e4bb31fef2','Fire and Emergency Services Instructor I (2007 Edition)','Fire and Emergency Services Instructor 1'),
('dff57491-9cf4-4bf7-a59e-78f2e86afff1','Fire and Emergency Services Instructor I (2019 Edition)','Fire and Emergency Services Instructor 1'),
('e9d34503-8c89-4f3e-b043-7b9e5e9d8854','Fire and Emergency Services Instructor I (IFSAC 2002 Edition)','Fire and Emergency Services Instructor 1'),
('eff65ce9-aac5-44c7-98a9-ee14ce83bb46','Fire and Emergency Services Instructor I (IFSAC 2007 Edition)','Fire and Emergency Services Instructor 1'),
('c3a6bef1-83ec-4b23-ac71-082ec841521a','Hazardous Materials Awareness (2008 Edition)','Hazardous Materials Awareness'),
('48b13ee5-9880-49ac-a4ac-d5182e31d8c4','Hazardous Materials Awareness (2017 Edition)','Hazardous Materials Awareness'),
('85412cf8-b7a9-4512-a79e-b154cebed965','Hazardous Materials Awareness (2022 Edition)','Hazardous Materials Awareness'),
('bbf50990-8d49-4cc5-af33-9495cddbb1eb','Hazardous Materials Awareness (IFSAC 2002 Edition)','Hazardous Materials Awareness'),
('1d756f97-db0e-442b-85bf-e495da3c7b43','Hazardous Materials Awareness (IFSAC 2008 Edition)','Hazardous Materials Awareness'),
('366eeb37-77cb-4043-b052-c808482c96c0','Hazardous Materials Awareness (IFSAC 2013 Edition)','Hazardous Materials Awareness'),
('1c308d38-c239-4e3a-8995-62caa459f72e','Hazardous Materials Operations (2008 Edition)','Hazardous Materials Operations'),
('52a09a41-dbbc-409a-955a-0cbbab885310','Hazardous Materials Operations (2017 Edition)','Hazardous Materials Operations'),
('7efd4f23-fd6e-433a-badf-e068acd72ce1','Hazardous Materials Operations (2022 Edition)','Hazardous Materials Operations'),
('f8ae970f-8116-4a0e-b549-05c2e148ebf8','Hazardous Materials Operations (IFSAC 2002 Edition)','Hazardous Materials Operations'),
('ca899d0d-d666-484c-8654-8c4b9791ac15','Hazardous Materials Operations (IFSAC 2008 Edition)','Hazardous Materials Operations'),
('3412ad81-0b6a-4dd4-bed6-cb5dc1be3d3b','Hazardous Materials Operations (IFSAC 2013 Edition)','Hazardous Materials Operations');

create temporary table approved_certification_records (
  record_id uuid primary key, member_id uuid not null,
  certification_id uuid not null, issued_at date not null
) on commit drop;
insert into approved_certification_records values
('0089f128-34be-4935-be0e-df9cc5e0e981','a08cf590-284c-43eb-b19a-b54f012de996','3412ad81-0b6a-4dd4-bed6-cb5dc1be3d3b','2018-01-02'),
('011dc363-efd7-4578-90a8-46d6e7533c67','b476c8a5-d1e6-4ae7-84cd-63e697266708','0486c3ea-fb25-4c79-9506-931d1a6a500b','2004-05-18'),
('02783420-0187-46ff-98ab-c87739b44b2d','f835c1cc-fefb-4eb5-b6b8-10c85a28ca9d','ff4d94c4-3b2f-42f6-93f6-d66aab60d3fe','2005-09-07'),
('0494a3d9-2fd4-4ab2-b934-a4277a12e98e','ccf4d654-3175-4ecd-a1c6-924d927a9145','57348a77-083d-4f6f-9f13-3ad86918d634','2006-07-18'),
('05cb6d66-4401-4ae6-9218-92ce16bce525','be108713-5e25-45a3-8817-0b4ef3529b97','bbf50990-8d49-4cc5-af33-9495cddbb1eb','2009-02-23'),
('062fd5ca-d996-43ec-ba33-1f65a3da9930','ccf4d654-3175-4ecd-a1c6-924d927a9145','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','2006-07-18'),
('0a4dab7a-7f84-4fdb-9ffe-099530454a19','ccf4d654-3175-4ecd-a1c6-924d927a9145','0486c3ea-fb25-4c79-9506-931d1a6a500b','2006-07-18'),
('0c8f79f6-f628-4dd5-8711-a4c536987d00','20d920ce-0c57-4ea6-8c46-0d04f6917134','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','2009-05-08'),
('0f66752a-e732-42f3-87fa-c548190f16ff','d3f0cc41-c9ba-4043-9ac3-4b29179fd5a3','22555ba1-95d3-48d5-a75f-96f4fe2c599b','2023-11-17'),
('0f728fc9-6426-4195-9fa2-8d411466128a','0814775b-221e-4d53-a94b-8984ba87fca0','e77c12d4-5af6-4c67-af82-88d693a18675','2015-02-17'),
('1c826f11-9f60-4bff-96f1-b54ce06b53f6','0814775b-221e-4d53-a94b-8984ba87fca0','eff65ce9-aac5-44c7-98a9-ee14ce83bb46','2010-02-24'),
('252cf371-2f14-407b-a9f1-2dede58cfbda','8eb298a0-627d-4034-a253-6b4e99544278','7efd4f23-fd6e-433a-badf-e068acd72ce1','2024-08-14'),
('256f018b-d6af-4e5e-9dcd-93516aa5c683','f835c1cc-fefb-4eb5-b6b8-10c85a28ca9d','e9d34503-8c89-4f3e-b043-7b9e5e9d8854','2009-06-26'),
('284bcfe5-7326-4a26-8b7a-fb2bdf741840','f3627638-0c2b-44ad-9962-fa873d801fdb','0486c3ea-fb25-4c79-9506-931d1a6a500b','2004-05-18'),
('2d57dfcb-a74a-49f2-af3d-4c8ff99a97a7','4e8a7800-1f22-489e-b6be-03496ec0d69a','1c308d38-c239-4e3a-8995-62caa459f72e','2014-08-29'),
('304d2b39-f13d-4610-a28d-b6da9a3659bf','cd05400e-a58d-499e-b03b-5b00603758b6','1d756f97-db0e-442b-85bf-e495da3c7b43','2009-12-21'),
('32b9cddc-ab05-40c9-b0e7-45f80c7a44c9','b1c6fdef-c2c8-4138-893a-77273a11eb65','52a09a41-dbbc-409a-955a-0cbbab885310','2022-05-31'),
('36a301d5-39eb-4e77-a06f-690d60a4bb1e','f8fe877b-e954-47da-881c-c5eb24b578e9','2151f6ff-974b-4928-8a80-876ba5fabf98','2010-05-25'),
('404b3c37-86b7-4662-9731-8d9aae81ed02','be108713-5e25-45a3-8817-0b4ef3529b97','6216b7ca-80c8-4de5-9a2a-93279b0e8a00','2026-09-22'),
('426b5324-92f8-4723-baba-f6c5a2d817cc','0814775b-221e-4d53-a94b-8984ba87fca0','3412ad81-0b6a-4dd4-bed6-cb5dc1be3d3b','2018-03-30'),
('4313363d-cad0-4cab-a9ae-9a12574df93a','f3627638-0c2b-44ad-9962-fa873d801fdb','182ffc8c-5512-4056-aba2-7ec9de4af5d6','2003-12-29'),
('490ab590-7e48-463a-becb-59b370320c6c','20d920ce-0c57-4ea6-8c46-0d04f6917134','f8ae970f-8116-4a0e-b549-05c2e148ebf8','2008-07-31'),
('50ec38d6-2d19-4bc8-8acf-2563774d68a7','ccf4d654-3175-4ecd-a1c6-924d927a9145','d2c9f193-c769-4a85-b0e3-7027d881d962','2006-07-18'),
('5224e585-074d-48e7-89f9-1942f529825d','cd05400e-a58d-499e-b03b-5b00603758b6','96930831-8d39-4b5d-90d3-3f705a69baa5','2026-06-17'),
('53bcce8a-cf18-4725-b31f-90d1f87b2b17','20d920ce-0c57-4ea6-8c46-0d04f6917134','5ef0b6e4-542d-4720-8fd2-70e4bb31fef2','2013-10-31'),
('58584123-0083-4c6e-8b70-2088a3a3957f','0814775b-221e-4d53-a94b-8984ba87fca0','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','2003-12-29'),
('5d35110c-bc22-4c35-86d4-d2d3ce6b749b','f3627638-0c2b-44ad-9962-fa873d801fdb','e9d34503-8c89-4f3e-b043-7b9e5e9d8854','2009-12-21'),
('5ffac756-235e-4156-ba11-b894b9363595','ccf4d654-3175-4ecd-a1c6-924d927a9145','eff65ce9-aac5-44c7-98a9-ee14ce83bb46','2010-01-11'),
('6028851c-eec4-4a95-b0f7-9258b7c3359f','4e8a7800-1f22-489e-b6be-03496ec0d69a','c3a6bef1-83ec-4b23-ac71-082ec841521a','2014-08-29'),
('631cfac8-81d0-4f92-b33e-0693297eecc3','cd05400e-a58d-499e-b03b-5b00603758b6','5ef0b6e4-542d-4720-8fd2-70e4bb31fef2','2013-09-09'),
('65c286cb-c585-4c3c-9ff7-2efe31f077f2','f3627638-0c2b-44ad-9962-fa873d801fdb','bbf50990-8d49-4cc5-af33-9495cddbb1eb','2008-07-31'),
('670b6d86-6b50-42e1-9e5b-e319db0691ff','d3f0cc41-c9ba-4043-9ac3-4b29179fd5a3','dff57491-9cf4-4bf7-a59e-78f2e86afff1','2024-10-30'),
('686af34b-1b05-4d8a-96bd-ed7b0bebfce7','f835c1cc-fefb-4eb5-b6b8-10c85a28ca9d','f8ae970f-8116-4a0e-b549-05c2e148ebf8','2008-07-31'),
('69ab4ab7-3a70-430b-b6d4-4827dbee74c8','cd05400e-a58d-499e-b03b-5b00603758b6','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','2010-01-12'),
('7306f0b7-3167-48ce-a317-acf8712608c0','f3627638-0c2b-44ad-9962-fa873d801fdb','ff4d94c4-3b2f-42f6-93f6-d66aab60d3fe','2006-01-13'),
('742fcbd3-94d3-4791-871e-00a7286edfff','8eb298a0-627d-4034-a253-6b4e99544278','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','2024-08-14'),
('74bc68f0-0285-48c0-8a31-2a4e1c3301f1','f835c1cc-fefb-4eb5-b6b8-10c85a28ca9d','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','1995-05-24'),
('784539a1-f9fa-4eb8-8612-d45b7f831202','cd05400e-a58d-499e-b03b-5b00603758b6','848c75ce-282d-4693-b795-26249c4e6b6e','2026-03-02'),
('78b02844-5fe3-4106-85f4-b9dcc84de041','cd05400e-a58d-499e-b03b-5b00603758b6','2151f6ff-974b-4928-8a80-876ba5fabf98','2010-06-02'),
('811d1b39-ed58-419c-a91a-d4a215a414f8','b476c8a5-d1e6-4ae7-84cd-63e697266708','ff4d94c4-3b2f-42f6-93f6-d66aab60d3fe','2006-01-13'),
('870a1a12-366a-42a9-b8fb-cbeda93dbe05','b1c6fdef-c2c8-4138-893a-77273a11eb65','6216b7ca-80c8-4de5-9a2a-93279b0e8a00','2026-02-07'),
('872a3dd7-49f0-473d-91fd-c4b4bbdb0eb4','b476c8a5-d1e6-4ae7-84cd-63e697266708','f8ae970f-8116-4a0e-b549-05c2e148ebf8','2008-07-31'),
('8aa650f3-c714-44d9-86b0-d12494ef8eea','cd05400e-a58d-499e-b03b-5b00603758b6','ca899d0d-d666-484c-8654-8c4b9791ac15','2009-12-21'),
('8d12ffbc-7ecc-4897-9fe3-81cf9a6b3b7c','a08cf590-284c-43eb-b19a-b54f012de996','366eeb37-77cb-4043-b052-c808482c96c0','2018-01-02'),
('911b1bd0-4625-4b29-a818-d914a5421205','d3f0cc41-c9ba-4043-9ac3-4b29179fd5a3','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','2024-01-24'),
('9675fd0c-b9d9-4b27-865b-8434fce0aad9','ccf4d654-3175-4ecd-a1c6-924d927a9145','d0b59cbb-30a3-486c-9686-007acae1f723','2012-10-31'),
('985d7eaa-7273-45bb-9cc7-0d0926436e55','f8fe877b-e954-47da-881c-c5eb24b578e9','d2af4e17-de74-495c-bef4-39676da59ae5','2012-01-10'),
('9a857663-e914-456c-a118-08895ff4cac0','9327814a-f26b-4f33-9f91-674d3d11fa89','f8ae970f-8116-4a0e-b549-05c2e148ebf8','2008-07-31'),
('9d49617d-d43d-4248-bf11-dc93da5c9f4f','d3f0cc41-c9ba-4043-9ac3-4b29179fd5a3','7efd4f23-fd6e-433a-badf-e068acd72ce1','2023-12-20'),
('a44cef07-92e9-4d5a-854f-f59b4977a2ad','4e8a7800-1f22-489e-b6be-03496ec0d69a','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','2014-09-11'),
('a7eb35cf-b0de-4efa-a343-e53f1b12f44f','b1c6fdef-c2c8-4138-893a-77273a11eb65','48b13ee5-9880-49ac-a4ac-d5182e31d8c4','2022-05-31'),
('b6a44604-2919-4b21-9b20-5b8e2e38de75','f835c1cc-fefb-4eb5-b6b8-10c85a28ca9d','9c24b5c5-3e19-498b-a4bf-b00b95bbabfb','1995-08-26'),
('b7a3ca7c-5e91-4741-882f-b5d2f2365b5d','8eb298a0-627d-4034-a253-6b4e99544278','85412cf8-b7a9-4512-a79e-b154cebed965','2024-08-14'),
('bdb97694-d5d1-447d-90ee-728131d8dc84','f8fe877b-e954-47da-881c-c5eb24b578e9','e9d34503-8c89-4f3e-b043-7b9e5e9d8854','2009-12-01'),
('be0ffca2-434c-489b-ab3f-05a47b361867','be108713-5e25-45a3-8817-0b4ef3529b97','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','2009-05-08'),
('c19fd2d2-786f-414b-a457-84a7ab4f4d2c','f8fe877b-e954-47da-881c-c5eb24b578e9','f8ae970f-8116-4a0e-b549-05c2e148ebf8','2008-07-31'),
('c1e56330-7f2a-4e18-bb5f-0284ecde321a','d3f0cc41-c9ba-4043-9ac3-4b29179fd5a3','85412cf8-b7a9-4512-a79e-b154cebed965','2023-12-20'),
('c30e0328-b7b2-41fc-860f-20296a0797fd','b1c6fdef-c2c8-4138-893a-77273a11eb65','11d5faa6-6f64-43f2-9651-031f51b985cc','2024-05-29'),
('c9d0be84-b1f4-4f81-8072-eefaa6bafa93','f3627638-0c2b-44ad-9962-fa873d801fdb','f8ae970f-8116-4a0e-b549-05c2e148ebf8','2008-07-31'),
('d1ce0254-605d-43d2-bcd5-3de824922208','f8fe877b-e954-47da-881c-c5eb24b578e9','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','2009-05-08'),
('d42d389e-a4a1-4cd7-b500-357a432aabd1','4e8a7800-1f22-489e-b6be-03496ec0d69a','237359f7-9fac-4f83-af93-ceca3cc00132','2026-06-14'),
('d989de82-a2ff-4ea3-b98c-6cdd28a6632a','a08cf590-284c-43eb-b19a-b54f012de996','11d5faa6-6f64-43f2-9651-031f51b985cc','2025-09-23'),
('dbbedd8b-39ac-4b17-be5c-8142ab17d48f','a08cf590-284c-43eb-b19a-b54f012de996','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','2018-01-02'),
('dd46d04b-89df-4543-a52e-c355e26c3630','d3f0cc41-c9ba-4043-9ac3-4b29179fd5a3','848c75ce-282d-4693-b795-26249c4e6b6e','2026-01-29'),
('e2174002-8cad-4146-8a34-51775d68a92f','be108713-5e25-45a3-8817-0b4ef3529b97','f8ae970f-8116-4a0e-b549-05c2e148ebf8','2009-02-23'),
('e677f8e3-677c-4075-8df2-105d2d09ec53','20d920ce-0c57-4ea6-8c46-0d04f6917134','2151f6ff-974b-4928-8a80-876ba5fabf98','2010-10-20'),
('e7ea09ae-0335-4c3e-964a-1ab13d30fa10','0814775b-221e-4d53-a94b-8984ba87fca0','a2f9090f-1b82-4f96-8348-7213de45453d','2013-08-22'),
('e9903c14-daa1-4a7d-b55b-d8ffac5a1a83','b1c6fdef-c2c8-4138-893a-77273a11eb65','60f6f89f-b2ff-4ac3-9e08-5b246f612e9a','2022-05-31'),
('f93ffba9-e3aa-4068-8d53-15fd70ba0088','d3f0cc41-c9ba-4043-9ac3-4b29179fd5a3','11d5faa6-6f64-43f2-9651-031f51b985cc','2024-07-03');

create temporary table approved_certification_recovery (
  record_id uuid primary key, member_id uuid not null, issued_at date not null,
  original_details text not null, source_page integer not null
) on commit drop;
insert into approved_certification_recovery values
('d1ce0254-605d-43d2-bcd5-3de824922208','f8fe877b-e954-47da-881c-c5eb24b578e9','2009-05-08','IFSAC 2002 Edition',1),
('58584123-0083-4c6e-8b70-2088a3a3957f','0814775b-221e-4d53-a94b-8984ba87fca0','2003-12-29','IFSAC 1997 Edition',2),
('742fcbd3-94d3-4791-871e-00a7286edfff','8eb298a0-627d-4034-a253-6b4e99544278','2024-08-14','2019 Edition',2),
('74bc68f0-0285-48c0-8a31-2a4e1c3301f1','f835c1cc-fefb-4eb5-b6b8-10c85a28ca9d','1995-05-24','IFSAC 1992 Edition',2),
('a44cef07-92e9-4d5a-854f-f59b4977a2ad','4e8a7800-1f22-489e-b6be-03496ec0d69a','2014-09-11','2008 Edition',1),
('062fd5ca-d996-43ec-ba33-1f65a3da9930','ccf4d654-3175-4ecd-a1c6-924d927a9145','2006-07-18','IFSAC 1997 Edition',2),
('0c8f79f6-f628-4dd5-8711-a4c536987d00','20d920ce-0c57-4ea6-8c46-0d04f6917134','2009-05-08','IFSAC 2002 Edition',3),
('911b1bd0-4625-4b29-a818-d914a5421205','d3f0cc41-c9ba-4043-9ac3-4b29179fd5a3','2024-01-24','Reciprocity',3),
('dbbedd8b-39ac-4b17-be5c-8142ab17d48f','a08cf590-284c-43eb-b19a-b54f012de996','2018-01-02','IFSAC 2013 Edition',3),
('be0ffca2-434c-489b-ab3f-05a47b361867','be108713-5e25-45a3-8817-0b4ef3529b97','2009-05-08','IFSAC 2002 Edition',3),
('e9903c14-daa1-4a7d-b55b-d8ffac5a1a83','b1c6fdef-c2c8-4138-893a-77273a11eb65','2022-05-31','2019 Edition',4),
('69ab4ab7-3a70-430b-b6d4-4827dbee74c8','cd05400e-a58d-499e-b03b-5b00603758b6','2010-01-12','IFSAC 2008 Edition',4);

do $$
begin
  if (select count(*) from certifications where department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97') <> 40
    or (select count(*) from approved_certification_mapping a join certifications c
      on c.id = a.legacy_id and c.name = a.original_name
      and c.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'
      and c.canonical_certification_id is null and c.active) <> 39
    or not exists (select 1 from certifications where id = '60f6f89f-b2ff-4ac3-9e08-5b246f612e9a'
      and department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'
      and name = 'Firefighter 1' and active and canonical_certification_id is null)
    or (select count(*) from member_certifications where department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97') <> 69
    or (select count(*) from approved_certification_records a join member_certifications mc
      on mc.id = a.record_id and mc.member_id = a.member_id
      and mc.certification_id = a.certification_id and mc.issued_at = a.issued_at
      where mc.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'
        and mc.expires_at is null and mc.notes is null and mc.certificate_number is null
        and mc.supporting_document_id is null) <> 69
    or exists (select 1 from member_certifications where department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97' and expires_at is not null)
    or (select count(*) from approved_certification_recovery a join member_certifications mc
      on mc.id = a.record_id and mc.member_id = a.member_id and mc.issued_at = a.issued_at
      and mc.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'
      and mc.certification_id = '60f6f89f-b2ff-4ac3-9e08-5b246f612e9a') <> 12 then
    raise exception 'Red Oak certification preflight differs from approved preservation manifest';
  end if;
end $$;

insert into public.certifications (department_id, name, active)
select '82f50d14-216a-4dd1-80f4-58459dc97b97', name, true from (
  values ('Firefighter 2'), ('Fire Apparatus Driver Operator Pumper'),
    ('Fire Apparatus Driver Operator Aerial'), ('Fire and Emergency Services Instructor 1'),
    ('Fire Inspector 1'), ('Fire Officer 1'), ('Fire Officer 2'),
    ('Hazardous Materials Awareness'), ('Hazardous Materials Operations')
) as standard(name);

update public.certifications c set canonical_certification_id = target.id
from approved_certification_mapping a, public.certifications target
where c.id = a.legacy_id and c.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'
  and target.department_id = c.department_id and target.name = a.standard_name;

insert into public.member_certification_details (member_certification_id, department_id, edition_details, source_reference)
select record_id, '82f50d14-216a-4dd1-80f4-58459dc97b97', original_details,
  'Red_Oak_Fire_Department_Certification_Roster_Updated.pdf, page ' || source_page ||
  '; source SHA256 88b10966ec995f93d7743b9038d3f26464aa92c9183d0776cf395bd672d74c3a; approved import snapshot'
from approved_certification_recovery;

do $$
begin
  if exists (
    (select kind, id, original from certification_preservation_before
     except select 'member', id, to_jsonb(mc) from member_certifications mc
     except select 'requirement', id, to_jsonb(r) from role_required_certifications r
     except select 'other_catalog', id, to_jsonb(c) from certifications c
       where department_id <> '82f50d14-216a-4dd1-80f4-58459dc97b97')
  ) or (select count(*) from member_certifications) <>
    (select count(*) from certification_preservation_before where kind = 'member')
    or (select count(*) from role_required_certifications) <>
      (select count(*) from certification_preservation_before where kind = 'requirement')
    or (select count(*) from certifications where department_id <> '82f50d14-216a-4dd1-80f4-58459dc97b97') <>
      (select count(*) from certification_preservation_before where kind = 'other_catalog')
    or (select count(*) from approved_certification_mapping a join certifications c on c.id = a.legacy_id
      join certifications target on target.id = c.canonical_certification_id
      where c.name = a.original_name and target.name = a.standard_name and target.department_id = c.department_id) <> 39
    or (select count(*) from approved_certification_recovery a join member_certification_details d
      on d.member_certification_id = a.record_id and d.edition_details = a.original_details
      and d.department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97') <> 12
    or (select count(*) from certifications where department_id = '82f50d14-216a-4dd1-80f4-58459dc97b97'
      and canonical_certification_id is null and active) <> 10 then
    raise exception 'Certification preservation postflight failed';
  end if;
end $$;
