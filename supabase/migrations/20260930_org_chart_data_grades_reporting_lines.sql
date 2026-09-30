
-- Backup kondisi sebelum penyesuaian (RLS aktif tanpa policy = tidak terbaca dari API publik)
create table if not exists public.employees_org_backup_20260930 as
  select id, employee_code, full_name, manager_id, department_id, "position", grade, now() as backed_up_at from public.employees;
alter table public.employees_org_backup_20260930 enable row level security;

-- Golongan dari data-karyawan.xlsx (by kode karyawan)
update public.employees e set grade = v.g
from (values ('CK001',5),('CK002',2),('CK003',1),('CK005',1),('CK006',1),('CK007',1),('CK008',1),('CK009',1),('CK010',1),('CK011',1),('CK012',1),('CK013',1),('CK015',2),('CK016',1),('CK017',1),('CK019',1),('CK020',2),('CK021',1),('CK022',1),('CK023',1),('CK026',2),('CK027',1),('CK028',5),('CK029',1),('CK030',1),('CK032',5),('CK033',1),('CK034',1),('CK035',1),('CK036',1),('CK037',1),('CK039',1),('CK042',1),('CK043',1),('CK044',1),('CK047',1),('CK048',1),('CK049',2),('CK051',1),('CK054',1),('CK057',1),('CK063',1),('CK067',3),('CK069',1),('CK070',1),('CK071',2),('CK075',1),('CK078',5),('CK079',1),('CK080',1),('CK083',2),('CK086',3),('CK089',1),('CK090',1),('CK093',1),('CK096',3),('CK098',1),('CK099',1),('CK100',1),('CK104',1),('CK106',1),('CK107',3),('CK109',1),('CK110',1),('CK112',1),('CK113',2),('CK114',1),('CK116',2),('CK117',2),('CK118',1),('CK120',3),('CK121',4),('CK122',2),('CK127',3),('CK128',1),('PJ001',5),('PJ002',2),('PJ003',1),('PJ004',1),('PJ006',1),('PJ008',1),('PJ009',1),('PJ010',1),('PJ012',1),('PJ015',3),('PJ016',1),('PJ017',1),('PJ018',1),('PJ021',1),('PK001',5),('PK004',1),('PK005',1),('PK006',1),('PK007',1),('PK008',1),('PK010',1),('PK011',1),('PK012',1),('PK013',1),('PK014',1),('PK015',1),('PK016',1),('PK019',1),('PK026',3),('PK027',1),('PK028',1),('PK029',1),('PK030',1),('PK035',1),('PK040',1),('PK044',1),('PK046',1),('PK049',1),('PK050',1),('PK054',1),('PK056',1),('PK057',1),('PK058',1),('PK059',1),('PK063',1),('PK067',1),('PK069',1),('PK071',1),('PK074',1),('PK076',1),('PK078',1),('PK079',1),('PK080',1),('PK081',1),('PK084',1),('PK085',1),('PK086',1),('PK088',1),('PK089',1),('PK090',1),('PK092',1),('PK093',1),('PK095',1),('PK096',1),('PK097',1),('PK098',1),('PK099',1),('PK100',1),('PK101',1),('PK102',1)) as v(code, g)
where e.employee_code = v.code;

-- Atasan langsung mengikuti Struktur_Organisasi_Napocut_2027.xlsx
update public.employees e set manager_id = m.id
from (values ('CK048','CK020'),('CK089','CK020'),('CK075','CK020'),('CK049','CK067'),('CK112','CK049'),('CK106','CK049'),('CK098','CK049'),('CK110','CK086'),('CK114','CK086'),('CK054','CK002'),('CK109','CK002'),('PJ012','PJ002'),('PJ010','PJ002'),('PJ006','PJ002'),('PJ008','PJ002'),('PJ003','PJ002'),('PJ009','PJ002'),('PJ016','PJ002'),('CK010','PJ002'),('CK009','PJ002'),('CK003','PJ002'),('CK005','PJ002'),('PK004','PJ002'),('PJ004','PJ018'),('PK029','PJ018'),('PJ017','PJ018'),('CK047','PJ018'),('PJ021','PJ018')) as x(emp_code, mgr_code)
join public.employees m on m.employee_code = x.mgr_code
where e.employee_code = x.emp_code;
