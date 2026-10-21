"""Браузерные функциональные тесты: отдельный сервер, изолированное состояние браузера, без внешних запросов."""
import os
import re
import unittest
import threading
from functools import partial
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

class CampusBrowser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        OUT.mkdir(exist_ok=True)
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT.parent)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/smart-campus-ai/'
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop(); cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1366,'height':900})
        self.page = self.context.new_page()
        self.page.set_default_timeout(6000)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda msg: self.errors.append(msg.text) if msg.type == 'error' else None)
        self.page.goto(self.url)

    def tearDown(self):
        errors = self.errors[:]
        self.context.close()
        self.assertEqual(errors, [], 'Browser errors')

    def login(self, role='Administrator'):
        email={'Administrator':'admin','Engineer':'engineer','Operator':'operator'}[role]
        self.page.get_by_label('Учебная роль', exact=True).select_option(role)
        self.page.get_by_label('Email', exact=True).fill(email+'@campus.demo')
        self.page.get_by_label('Пароль', exact=True).fill('campus-demo')
        self.page.get_by_role('button', name='Войти в систему').click()
        expect(self.page.get_by_role('heading',name='Состояние кампуса')).to_be_visible()

    def route(self, value):
        self.page.evaluate('(route)=>{location.hash=route}', value)
        expect(self.page.locator('main')).to_have_attribute('data-route', value.split('?')[0].split('/')[0])

    def test_shell_login_theme_session_and_routes(self):
        self.page.get_by_label('Email',exact=True).fill('admin@campus.demo')
        self.page.get_by_label('Пароль',exact=True).fill('wrong')
        self.page.get_by_role('button',name='Войти в систему').click()
        expect(self.page.get_by_role('alert')).to_contain_text('Неверный')
        self.login()
        for route in ['rooms','devices','incidents','analytics','notifications','settings','dashboard']:
            self.page.locator(f'nav a[href="#{route}"]').click()
            expect(self.page.locator('main')).to_have_attribute('data-route',route)
            expect(self.page.locator('main h1')).to_be_visible()
        self.page.get_by_role('button',name='Сменить тему',exact=True).click()
        expect(self.page.locator('html')).to_have_attribute('data-theme','light')
        self.page.reload()
        expect(self.page.locator('html')).to_have_attribute('data-theme','light')
        expect(self.page.get_by_role('heading',name='Состояние кампуса')).to_be_visible()
        self.page.get_by_role('button',name='Выйти',exact=True).click()
        expect(self.page.get_by_role('button',name='Войти в систему')).to_be_visible()
        self.page.goto(self.url+'#rooms')
        expect(self.page.get_by_role('button',name='Войти в систему')).to_be_visible()

    def test_room_device_filters_details_and_quick_search(self):
        self.login(); self.route('rooms')
        expect(self.page.locator('tbody tr')).to_have_count(12)
        self.page.get_by_label('Поиск помещений').fill('A-205')
        expect(self.page.locator('tbody tr')).to_have_count(1)
        self.page.get_by_role('link',name='A-205',exact=True).click()
        expect(self.page.get_by_role('heading',name='A-205',exact=True)).to_be_visible()
        self.page.get_by_role('link',name='Устройства помещения').click()
        expect(self.page.locator('tbody tr')).to_have_count(3)
        self.page.locator('tbody a[href^="#devices/"]').first.click()
        expect(self.page.get_by_role('heading',name='TEMP-A-205-01',exact=True)).to_be_visible()
        self.page.get_by_role('link',name='A-205',exact=True).click()
        expect(self.page.get_by_role('heading',name='A-205',exact=True)).to_be_visible()
        self.route('rooms')
        self.page.get_by_label('Корпус',exact=True).select_option('B')
        expect(self.page.locator('tbody tr')).to_have_count(3)
        self.page.get_by_label('Статус',exact=True).select_option('critical')
        expect(self.page.locator('tbody tr')).to_have_count(1)
        self.page.get_by_role('button',name='Сбросить фильтры').click()
        expect(self.page.locator('tbody tr')).to_have_count(12)
        self.page.get_by_label('Поиск помещений').fill('zzz-no-room')
        expect(self.page.get_by_text('Ничего не найдено',exact=True)).to_be_visible()
        self.page.keyboard.press('Control+k')
        self.page.get_by_label('Помещение, устройство или раздел').fill('CO2-C-202')
        self.page.get_by_role('link',name='CO2-C-202-01').click()
        expect(self.page.get_by_role('heading',name='CO2-C-202-01',exact=True)).to_be_visible()
        expect(self.page.get_by_text('Последнее сохраненное показание',exact=False).first).to_be_visible()
        self.page.reload()
        expect(self.page.get_by_role('heading',name='CO2-C-202-01',exact=True)).to_be_visible()

    def test_engineer_maintenance_persists_and_operator_cannot_modify(self):
        self.login('Engineer'); self.route('devices/TEMP-A-101-01')
        self.page.get_by_role('button',name='Вывести на обслуживание').click()
        self.page.get_by_role('button',name='Подтвердить',exact=True).click()
        expect(self.page.get_by_text('Offline',exact=True)).to_be_visible()
        self.page.reload()
        expect(self.page.get_by_text('Offline',exact=True)).to_be_visible()
        self.route('notifications')
        expect(self.page.get_by_text('TEMP-A-101-01',exact=True)).to_be_visible()
        self.route('settings')
        expect(self.page.get_by_role('button',name='Сохранить параметры')).to_have_count(0)
        self.page.get_by_role('button',name='Выйти',exact=True).click()
        self.login('Operator'); self.route('devices/TEMP-A-101-01')
        expect(self.page.get_by_role('button',name='Вернуть в сеть')).to_have_count(0)
        expect(self.page.get_by_text('Offline',exact=True)).to_be_visible()
        self.route('notifications')
        self.page.get_by_role('button',name='Отметить прочитанным').first.click()
        expect(self.page.get_by_text('Прочитано',exact=True)).to_have_count(1)
        self.page.reload()
        expect(self.page.get_by_text('Прочитано',exact=True)).to_have_count(1)

    def test_admin_settings_reset_and_storage_integrity(self):
        self.login(); self.route('settings')
        self.page.get_by_label('Название кампуса').fill('Кампус КС-3-24')
        self.page.get_by_role('button',name='Сохранить параметры').click()
        self.page.reload()
        expect(self.page.locator('#campus-name')).to_have_text('Кампус КС-3-24')
        self.page.evaluate("localStorage.setItem('unrelated', 'preserve')")
        self.page.get_by_role('button',name='Сбросить учебные данные').click()
        self.page.get_by_role('button',name='Отмена',exact=True).click()
        expect(self.page.locator('#campus-name')).to_have_text('Кампус КС-3-24')
        self.page.get_by_role('button',name='Сбросить учебные данные').click()
        self.page.get_by_role('button',name='Подтвердить',exact=True).click()
        expect(self.page.locator('#campus-name')).to_have_text('Smart Campus')
        self.assertEqual(self.page.evaluate("localStorage.getItem('unrelated')"),'preserve')
        self.page.evaluate("localStorage.setItem('smart-campus:state:v1', '{broken')")
        self.page.reload()
        expect(self.page.locator('.sc-storage-warning')).to_contain_text('повреждены')
        self.route('rooms')
        expect(self.page.locator('tbody tr')).to_have_count(12)

    def test_real_chart_instances_values_room_selection_and_cleanup(self):
        self.login(); self.route('analytics')
        expect(self.page.locator('main canvas')).to_have_count(3)
        data = self.page.evaluate("""()=>Object.values(Chart.instances).map(c=>({type:c.config.type,data:c.data.datasets[0].data}))""")
        self.assertEqual({d['type'] for d in data}, {'bar','line','doughnut'})
        self.assertIn([39,1], [d['data'] for d in data])
        self.page.get_by_label('Помещение графика',exact=True).select_option('B-201')
        self.assertEqual(self.page.evaluate("Chart.getChart(document.querySelector('#analytics-temperature canvas')).data.datasets[0].data.at(-1)"),32.8)
        self.route('rooms')
        self.assertEqual(self.page.evaluate('Object.keys(Chart.instances).length'),0)
        self.route('dashboard')
        expect(self.page.locator('main canvas')).to_have_count(1)
        self.page.get_by_role('button',name='Сменить тему',exact=True).click()
        self.assertEqual(self.page.evaluate('Object.keys(Chart.instances).length'),1)

    def assert_no_overflow(self):
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), f'Page overflow at {self.page.viewport_size}: {self.page.url}')

    def test_responsive_all_routes_two_themes_and_screenshots(self):
        for width in [1920,1366,768,390]:
            self.page.set_viewport_size({'width':width,'height':900})
            self.assert_no_overflow()
            self.page.screenshot(path=str(OUT/f'login-dark-{width}.png'),full_page=True)
        self.login()
        for width in [1920,1366,768,390]:
            self.page.set_viewport_size({'width':width,'height':900})
            for theme in ['dark','light']:
                self.page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
                for route in ['dashboard','rooms','devices','incidents','analytics','notifications','settings','rooms/A-205','devices/CO2-C-202-01']:
                    with self.subTest(width=width,theme=theme,route=route):
                        self.route(route)
                        self.assert_no_overflow()
                        for button in self.page.locator('main button').all():
                            self.assertGreaterEqual(button.bounding_box()['width'],32)
                        if route in ['dashboard','rooms','analytics']:
                            self.page.screenshot(path=str(OUT/f'{route}-{theme}-{width}.png'),full_page=True)
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.get_by_role('button',name='Открыть меню',exact=True).click()
        expect(self.page.get_by_role('button',name='Закрыть меню',exact=True)).to_be_focused()
        self.page.locator('nav a[href="#rooms"]').click()
        expect(self.page.get_by_label('Поиск помещений')).to_be_visible()
        self.assert_no_overflow()
        self.page.get_by_role('button',name='Открыть меню',exact=True).click()
        self.page.keyboard.press('Escape')
        expect(self.page.get_by_role('button',name='Открыть меню',exact=True)).to_be_focused()

    def test_storage_injection_invalid_sessions_and_direct_links(self):
        self.page.evaluate("sessionStorage.setItem('smart-campus:session',JSON.stringify({role:'owner',email:'admin@campus.demo'}))")
        self.page.reload()
        expect(self.page.get_by_role('button',name='Войти в систему')).to_be_visible()
        self.login(); self.route('settings')
        payload='<img src=x onerror="window.injected=true">'
        self.page.get_by_label('Название кампуса').fill(payload)
        self.page.get_by_role('button',name='Сохранить параметры').click()
        self.page.reload()
        expect(self.page.locator('#campus-name')).to_have_text(payload)
        self.assertIsNone(self.page.evaluate('window.injected'))
        self.route('rooms/missing')
        expect(self.page.get_by_role('heading',name='Помещение не найдено')).to_be_visible()
        self.page.goto(self.url+'#devices/%E0%A4%A')
        expect(self.page.get_by_role('heading')).to_be_visible()
        self.page.goto(self.url+'#unknown')
        expect(self.page.get_by_role('heading',name='Состояние кампуса')).to_be_visible()
        self.route('rooms')
        self.page.locator('.sc-skip-link').focus()
        self.page.keyboard.press('Enter')
        expect(self.page.locator('main')).to_be_focused()
        expect(self.page.locator('main')).to_have_attribute('data-route','rooms')

    def test_storage_denial_is_explained_and_actions_still_work_in_memory(self):
        self.context.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Denied','SecurityError')}})")
        self.page.reload(); self.login();
        expect(self.page.locator('.sc-storage-warning')).to_contain_text('недоступно')
        self.route('settings')
        self.page.get_by_label('Название кампуса').fill('В памяти')
        self.page.get_by_role('button',name='Сохранить параметры').click()
        expect(self.page.locator('#campus-name')).to_have_text('В памяти')
        expect(self.page.locator('.sc-storage-warning')).to_contain_text('Не удалось сохранить')

    def test_session_storage_denial_explains_temporary_login(self):
        self.context.add_init_script("Object.defineProperty(window,'sessionStorage',{get(){throw new DOMException('Denied','SecurityError')}})")
        self.page.reload(); self.login()
        expect(self.page.locator('.sc-session-warning')).to_contain_text('Сеанс')
        expect(self.page.locator('.sc-session-warning')).to_contain_text('перезагрузки')
        self.page.reload()
        expect(self.page.get_by_role('button',name='Войти в систему')).to_be_visible()

if __name__ == '__main__':
    unittest.main(verbosity=2)
