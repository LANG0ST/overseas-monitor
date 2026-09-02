-- One-time beta reset and production catalogue import.
-- Keep profiles, permissions, and settings; replace business/test data only.

begin;

update public.documents
set is_active = false
where source_pointage_sheet_id is not null and is_active;

delete from public.pointage_entries;
delete from public.documents;
delete from public.pointage_sheets;
delete from public.partenaires;
delete from public.engins;

insert into public.partenaires (name, ice, address) values
  ('AFRICA GLOBAL LOGISTICS & SHIPPING MAROC', '001527059000033', '43 BD KHALID IBNOU LOUALID, AIN SEBAA, CASABLANCA'),
  ('CHINA OVERSEAS ENGINEERING CORPORATION', '001596313000044', 'INARA, ROUTE 28 N°25, CALIFORNIE, 20150 CASABLANCA'),
  ('MINGDIAN INTERNATIONAL', '003389053000034', null),
  ('GOTION POWER MOROCCO', '003520699000060', null),
  ('ZHONGLI CONSTRUCTION', '003069395000031', null),
  ('CHINA CONSTRUCTION YANGTZE MAROC', '002086799000041', null),
  ('ALMADEN MOROCCO', '001921213000036', null),
  ('PLANET COM TRANS', '001868774000077', null),
  ('OVERSEAS LIFTING', '003654969000048', null),
  ('TG NORTH AFRICA SARL', '003844653000083', null),
  ('CROMAT MATERIAUX', '003884477000080', 'GROUPE ATTAKADDOUM GH2-17, 2EME ETG, SIDI BERNOUSSI'),
  ('ZHONGCHENG INTERNATIONAL SARL', '003775962000003', null),
  ('MINGLAI', '00379735000081', null),
  ('WORLDWIDE LOGISTICS MOROCCO SHIPPING SERVICE', null, null);

insert into public.engins (name, category, unit, default_price) values
  ('CHARIOT ELEVATEUR 3T', 'Manutention & Levage', 'Jour', 1000),
  ('CHARIOT ELEVATEUR 5T', 'Manutention & Levage', 'Jour', 1077),
  ('CHARIOT ELEVATEUR 16T', 'Manutention & Levage', 'Jour', 2200),
  ('CHARIOT ELEVATEUR TELESCOPIQUE', 'Manutention & Levage', 'Jour', 1500),
  ('TRANSPALETTE ELECTRIQUE', 'Manutention & Levage', 'Jour', 350),
  ('NACELLE CISEAUX 8M', 'Manutention & Levage', 'Mois', 15500),
  ('NACELLE ELECTRIQUE 16M', 'Manutention & Levage', 'Jour', 850),
  ('NACELLE DIESEL 18M', 'Manutention & Levage', 'Jour', 850),

  ('GRUE MOBILE 35T', 'Grues', 'Jour', 2307),
  ('GRUE MOBILE 40T', 'Grues', 'Jour', 2615),
  ('GRUE MOBILE 75T', 'Grues', 'Mois', 145000),
  ('GRUE MOBILE 100T', 'Grues', 'Jour', 5000),
  ('GRUE MOBILE 130T', 'Grues', 'Jour', 19000),
  ('GRUE MOBILE 160T', 'Grues', 'Jour', 21000),
  ('CAMION GRUE', 'Grues', 'Jour', 1923),
  ('PORTCHAR 100T', 'Grues', 'Fois', 60000),

  ('PELLE SUR CHENILLES CAT 320C', 'Terrassement & Excavation', 'Jour', 2000),
  ('PELLE SUR CHENILLES VOLVO', 'Terrassement & Excavation', 'Jour', 2000),
  ('EXCAVATEUR SUR PNEUS CAT 318', 'Terrassement & Excavation', 'Jour', 1615),
  ('EXCAVATEUR SUR PNEUS FIAT HITACHI', 'Terrassement & Excavation', 'Jour', 1615),
  ('EXCAVATEUR SUR CHENILLES CAT 322', 'Terrassement & Excavation', 'Jour', 2300),
  ('EXCAVATEUR SUR CHENILLES CAT 325', 'Terrassement & Excavation', 'Jour', 2076),
  ('CHARGEUSE 950H', 'Terrassement & Excavation', 'Jour', 2300),
  ('TRACTOPELLE', 'Terrassement & Excavation', 'Jour', 1000),
  ('JCB AVEC MARTEAU', 'Terrassement & Excavation', 'Jour', 1538),
  ('JCB AVEC GODET', 'Terrassement & Excavation', 'Jour', 1300),

  ('CAMION 8X4', 'Camions & Transport', 'Jour', 1700),
  ('CAMION CITERNE D''EAU', 'Camions & Transport', 'Jour', 800),
  ('CAMION PLATEAU', 'Camions & Transport', 'Jour', 1500),

  ('COMPACTEUR', 'Misc', 'Jour', 1400);

do $$
declare
  sequence_record record;
begin
  for sequence_record in
    select schemaname, sequencename
    from pg_sequences
    where schemaname = 'public'
      and sequencename like 'document_numbers_%_seq'
  loop
    execute format(
      'alter sequence %I.%I restart with 1',
      sequence_record.schemaname,
      sequence_record.sequencename
    );
  end loop;
end
$$;

commit;
