import re

f = r'c:\Users\cedri\OneDrive - ELITE CAPITAL Group S.A\Documents\EMS\extranet\backend\app\routers\analytics_router.py'
c = open(f, encoding='utf-8').read()

# Replace emp.departement with dept_obj.nom if dept_obj else ''
new_c = re.sub(r"emp\.departement or ''", "dept_obj.nom if dept_obj else ''", c)

if new_c != c:
    open(f, 'w', encoding='utf-8').write(new_c)
    print('Fixed remaining emp.departement')
else:
    print('No change - checking exact content around that area...')
    idx = c.find('emp.departement')
    if idx == -1:
        print('emp.departement not found - already fixed!')
    else:
        line = c[:idx].count('\n') + 1
        print(f'Found at line {line}: {repr(c[max(0,idx-30):idx+50])}')
