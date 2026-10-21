import unittest
from playwright.sync_api import expect
import browser as baseline

class StageTwoBrowser(baseline.CampusBrowser):
    def test_settings_draft_survives_tick_and_save_click(self):
        self.page.clock.install();self.page.reload();self.login()
        self.page.get_by_role('button',name='Запустить симуляцию',exact=True).click();self.route('settings')
        self.page.get_by_label('Название кампуса',exact=True).fill('Draft campus')
        self.page.clock.run_for(5000)
        self.page.get_by_role('button',name='Сохранить параметры',exact=True).click()
        expect(self.page.locator('#campus-name')).to_have_text('Draft campus')
        self.page.reload();expect(self.page.locator('#campus-name')).to_have_text('Draft campus')

    def test_tick_preserves_specific_button_and_link_focus(self):
        self.page.clock.install();self.page.reload();self.login()
        self.page.get_by_role('button',name='Запустить симуляцию',exact=True).click();self.route('incidents')
        button=self.page.locator('[data-action="incident-edit"][data-id="3"]');button.focus()
        self.page.clock.run_for(5000);expect(button).to_be_focused()
        self.route('dashboard');link=self.page.locator('main a[href="#analytics"]').first;link.focus()
        self.page.clock.run_for(5000);expect(link).to_be_focused()

    def test_new_forms_and_analytics_responsive_both_themes(self):
        self.login();self.inject_anomaly()
        for width in [1920,1366,768,390]:
            self.page.set_viewport_size({'width':width,'height':900})
            for theme in ['dark','light']:
                self.page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
                with self.subTest(width=width,theme=theme):
                    self.route('incidents')
                    self.page.get_by_role('button',name='Добавить инцидент',exact=True).click()
                    self.incident_fields('Проверка адаптивной формы')
                    dialog=self.page.locator('#incident-dialog')
                    self.assert_no_overflow()
                    self.assertLessEqual(dialog.bounding_box()['width'],width)
                    self.page.get_by_role('button',name='Отмена',exact=True).scroll_into_view_if_needed()
                    self.page.screenshot(path=str(baseline.OUT/f'incident-form-{theme}-{width}.png'))
                    self.page.keyboard.press('Escape')
                    expect(dialog).to_have_count(0)
                    self.route('analytics');self.page.locator('.sc-diagnostics summary').click()
                    self.assert_no_overflow()
                    expect(self.page.locator('#analysis-diagnostics')).to_be_visible()
                    self.page.screenshot(path=str(baseline.OUT/f'analytics-stage2-{theme}-{width}.png'),full_page=True)

    def test_simulation_values_agree_across_charts_kpi_registries_and_reload(self):
        self.login();self.page.get_by_role('button',name='Ручной шаг',exact=True).click()
        s=self.page.evaluate("JSON.parse(localStorage.getItem('smart-campus:state:v1'))")
        total=round(sum(r['energy'] for r in s['rooms']),1)
        displayed=self.page.locator('.sc-kpi').filter(has_text='Энергия за час').locator('.sc-kpi-value').inner_text()
        self.assertAlmostEqual(float(displayed.split()[0].replace(',','.')),total,places=1)
        self.route('analytics')
        actual=self.page.evaluate("Chart.getChart(document.querySelector('#analytics-energy canvas')).data.datasets[0].data")
        expected=[round(sum(r['energy'] for r in s['rooms'] if r['building']==b),1) for b in ['A','B','C','D']]
        self.assertEqual(actual,expected)
        d=s['devices'][0];self.route('devices/'+d['id'])
        expect(self.page.locator('main')).to_contain_text(str(d['value']).replace('.',','))
        self.route('rooms?building=A')
        expect(self.page.locator('tbody tr').filter(has_text='A-101').first).to_contain_text(str(d['value']).replace('.',','))
        self.page.reload()
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('smart-campus:state:v1')).devices[0].value"),d['value'])

    def test_migration_of_stage_one_state_preserves_user_fields_and_read_marks(self):
        self.login()
        self.page.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('smart-campus:state:v1'));s.version=1;delete s.incidentNextId;s.devices.forEach(d=>delete d.history);s.settings.campusName='Кампус этапа 1';s.incidents[0].comment='Сохраненный комментарий';s.readNotifications['admin@campus.demo']=['co2:A-205'];localStorage.setItem('smart-campus:state:v1',JSON.stringify(s));}""")
        self.page.reload();expect(self.page.locator('#campus-name')).to_have_text('Кампус этапа 1')
        self.route('notifications');expect(self.page.get_by_text('Прочитано',exact=True)).to_have_count(1)
        self.route('incidents');expect(self.page.locator('#incident-results')).to_contain_text('Сохраненный комментарий')
        self.page.get_by_role('button',name='Добавить инцидент',exact=True).click();self.incident_fields('После миграции')
        self.page.get_by_role('button',name='Сохранить инцидент',exact=True).click()
        self.page.reload();expect(self.page.locator('#incident-results')).to_contain_text('#5')
        self.assertEqual(self.page.evaluate("JSON.parse(localStorage.getItem('smart-campus:state:v1')).version"),2)

    def test_empty_incident_journal_and_analytics_have_honest_states(self):
        self.login()
        self.page.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('smart-campus:state:v1'));s.incidents=[];const now=Date.now();for(const r of s.rooms){r.temperature=24;r.co2=700;r.energy=2;r.baseline=3;r.occupancy=10;r.updatedAt=new Date(now).toISOString();r.history=[-5,-4,-3,-2,-1,0].map(i=>({at:new Date(now+i*5000).toISOString(),value:24}));}for(const d of s.devices.filter(d=>d.metric)){const r=s.rooms.find(r=>r.id===d.room);d.value=r[d.metric];d.status='online';d.updatedAt=r.updatedAt;d.history=[-5,-4,-3,-2,-1,0].map(i=>({at:new Date(now+i*5000).toISOString(),value:d.value}));}localStorage.setItem('smart-campus:state:v1',JSON.stringify(s));}""")
        self.page.reload();self.route('incidents')
        expect(self.page.locator('#incident-results')).to_contain_text('Ничего не найдено')
        self.route('analytics')
        expect(self.page.locator('#anomaly-results')).to_contain_text('Статистических аномалий нет')
        expect(self.page.locator('#recommendations')).to_contain_text('Рекомендаций для выбранных фильтров нет')
        self.route('notifications');expect(self.page.locator('article')).to_have_count(0)

    def test_reset_pauses_running_simulation_and_restores_seed(self):
        self.page.clock.install();self.page.reload();self.login()
        self.page.get_by_role('button',name='Запустить симуляцию',exact=True).click()
        self.page.clock.run_for(5000);self.route('settings')
        self.page.get_by_role('button',name='Сбросить учебные данные',exact=True).click()
        self.page.get_by_role('button',name='Подтвердить',exact=True).click()
        expect(self.page.locator('#simulation-status')).to_contain_text('Пауза')
        snapshot=self.page.evaluate("localStorage.getItem('smart-campus:state:v1')")
        self.page.clock.run_for(15000)
        self.assertEqual(self.page.evaluate("localStorage.getItem('smart-campus:state:v1')"),snapshot)

    def inject_anomaly(self):
        self.page.evaluate("""()=>{
          const s=JSON.parse(localStorage.getItem('smart-campus:state:v1')),d=s.devices[0];
          const now=Date.now(),values=[22,23,22.5,23,22.8,23.1,31];
          d.value=31;d.updatedAt=new Date(now).toISOString();
          d.history=values.map((value,i)=>({value,at:new Date(now-(6-i)*5000).toISOString()}));
          s.rooms[0].temperature=31;s.rooms[0].history=structuredClone(d.history);
          localStorage.setItem('smart-campus:state:v1',JSON.stringify(s));
        }""")
        self.page.reload()

    def test_analysis_numeric_explanations_filters_recommendations_and_notifications(self):
        self.login();self.inject_anomaly();self.route('analytics')
        row=self.page.locator('#anomaly-results tbody tr').filter(has_text='TEMP-A-101-01')
        expect(row).to_have_count(1);expect(row).to_contain_text('31')
        self.assertAlmostEqual(float(row.locator('[data-field="mean"]').inner_text().replace(',','.')),22.733,places=3)
        self.assertGreater(float(row.locator('[data-field="z"]').inner_text().replace(',','.')),2)
        expect(self.page.locator('#recommendations')).to_contain_text('резкое отклонение')
        self.page.get_by_label('Показатель аналитики',exact=True).select_option('co2')
        expect(self.page.locator('#anomaly-results')).to_contain_text('Статистических аномалий нет')
        self.page.get_by_label('Показатель аналитики',exact=True).select_option('temperature')
        expect(self.page.locator('#anomaly-results tbody tr')).to_have_count(1)
        self.route('notifications')
        expect(self.page.locator('article').filter(has_text='Статистическая аномалия')).to_have_count(1)
        self.page.locator('article').filter(has_text='Статистическая аномалия').get_by_role('link',name='Открыть объект').click()
        expect(self.page.get_by_role('heading',name='TEMP-A-101-01',exact=True)).to_be_visible()

    def test_not_found_headings_receive_focus(self):
        self.login();self.route('rooms/missing')
        expect(self.page.get_by_role('heading',name='Помещение не найдено')).to_be_focused()
        self.route('devices/missing')
        expect(self.page.get_by_role('heading',name='Устройство не найдено')).to_be_focused()

    def test_simulation_controls_navigation_offline_history_and_reload(self):
        self.page.clock.install()
        self.page.reload(); self.login();self.route('analytics')
        expect(self.page.locator('#simulation-status')).to_contain_text('Пауза')
        before=self.page.evaluate("JSON.parse(localStorage.getItem('smart-campus:state:v1'))")
        self.page.get_by_label('Помещение графика',exact=True).select_option('B-201')
        self.page.get_by_role('button',name='Ручной шаг',exact=True).click()
        after=self.page.evaluate("JSON.parse(localStorage.getItem('smart-campus:state:v1'))")
        self.assertEqual(after['devices'][22],before['devices'][22])  # Датчик CO₂ в C-202 недоступен; его данные не должны измениться.
        self.assertEqual(len(after['devices'][0]['history']),len(before['devices'][0]['history'])+1)
        expect(self.page.get_by_label('Помещение графика',exact=True)).to_have_value('B-201')
        self.page.get_by_role('button',name='Запустить симуляцию',exact=True).click()
        self.route('rooms');self.route('dashboard');self.page.clock.run_for(5000)
        expect(self.page.locator('#simulation-step-count')).to_have_text('2')
        self.page.get_by_role('button',name='Пауза симуляции',exact=True).click()
        snapshot=self.page.evaluate("localStorage.getItem('smart-campus:state:v1')")
        self.page.clock.run_for(15000)
        self.assertEqual(self.page.evaluate("localStorage.getItem('smart-campus:state:v1')"),snapshot)
        self.page.get_by_role('button',name='Запустить симуляцию',exact=True).click();self.page.reload()
        expect(self.page.locator('#simulation-status')).to_contain_text('Пауза')
        self.assertEqual(self.page.evaluate("localStorage.getItem('smart-campus:state:v1')"),snapshot)

    def test_running_simulation_preserves_incident_draft_and_logout_stops_it(self):
        self.page.clock.install();self.page.reload();self.login()
        self.page.get_by_role('button',name='Запустить симуляцию',exact=True).click()
        self.route('incidents');self.page.get_by_role('button',name='Добавить инцидент',exact=True).click()
        self.page.get_by_label('Описание проблемы',exact=True).fill('Черновик не теряется')
        self.page.clock.run_for(10000)
        expect(self.page.get_by_label('Описание проблемы',exact=True)).to_have_value('Черновик не теряется')
        expect(self.page.locator('#incident-dialog')).to_be_visible()
        self.page.get_by_role('button',name='Отмена',exact=True).click()
        self.page.get_by_role('button',name='Выйти',exact=True).click()
        snapshot=self.page.evaluate("localStorage.getItem('smart-campus:state:v1')")
        self.page.clock.run_for(10000)
        self.assertEqual(self.page.evaluate("localStorage.getItem('smart-campus:state:v1')"),snapshot)
        self.login('Operator')
        expect(self.page.get_by_role('button',name='Ручной шаг',exact=True)).to_have_count(0)
        self.page.evaluate("""()=>{const b=document.createElement('button');b.dataset.action='simulation-step';document.querySelector('main').append(b);b.click()}""")
        expect(self.page.locator('#toast')).to_contain_text('прав')

    def incident_fields(self,title='Новая неисправность'):
        self.page.get_by_label('Описание проблемы',exact=True).fill(title)
        self.page.get_by_label('Помещение инцидента',exact=True).select_option('A-101')
        self.page.get_by_label('Приоритет инцидента',exact=True).select_option('high')
        self.page.get_by_label('Статус инцидента',exact=True).select_option('open')
        self.page.get_by_label('Ответственный',exact=True).fill('Дежурный инженер')
        self.page.get_by_label('Комментарий',exact=True).fill('Проверка')

    def test_incident_crud_cancel_validation_persistence_and_filters(self):
        self.login(); self.route('incidents')
        expect(self.page.locator('#incident-results tbody tr')).to_have_count(4)
        self.page.get_by_role('button',name='Добавить инцидент',exact=True).click()
        self.page.get_by_role('button',name='Сохранить инцидент',exact=True).click()
        expect(self.page.locator('#incident-dialog')).to_be_visible()
        self.incident_fields('<img src=x onerror="window.injected=true">')
        self.page.get_by_role('button',name='Сохранить инцидент',exact=True).click()
        expect(self.page.locator('#incident-results tbody tr')).to_have_count(5)
        self.assertIsNone(self.page.evaluate('window.injected'))
        self.page.reload(); row=self.page.locator('#incident-results tbody tr').filter(has_text='#5')
        row.get_by_role('button',name='Редактировать',exact=True).click()
        self.page.get_by_label('Описание проблемы',exact=True).fill('Не должно сохраниться')
        self.page.get_by_role('button',name='Отмена',exact=True).click()
        expect(row).not_to_contain_text('Не должно сохраниться')
        row.get_by_role('button',name='Редактировать',exact=True).click()
        self.page.get_by_label('Описание проблемы',exact=True).fill('Обновленный инцидент')
        self.page.get_by_label('Статус инцидента',exact=True).select_option('resolved')
        self.page.get_by_role('button',name='Сохранить инцидент',exact=True).click()
        expect(row).to_contain_text('Обновленный инцидент')
        expect(self.page.locator('#incident-results tbody tr')).to_have_count(5)
        self.page.get_by_label('Поиск инцидентов',exact=True).fill('Обновленный')
        expect(self.page.locator('#incident-results tbody tr')).to_have_count(1)
        self.page.get_by_label('Фильтр статуса инцидентов',exact=True).select_option('open')
        expect(self.page.locator('#incident-results')).to_contain_text('Ничего не найдено')
        self.page.get_by_label('Фильтр статуса инцидентов',exact=True).select_option('resolved')
        self.page.locator('#incident-results').get_by_role('button',name='Удалить',exact=True).click()
        self.page.get_by_role('button',name='Отмена',exact=True).click()
        expect(self.page.locator('#incident-results tbody tr')).to_have_count(1)
        self.page.locator('#incident-results').get_by_role('button',name='Удалить',exact=True).click()
        self.page.get_by_role('button',name='Подтвердить',exact=True).click()
        expect(self.page.locator('#incident-results')).to_contain_text('Ничего не найдено')
        self.page.reload();self.route('incidents')
        expect(self.page.locator('#incident-results tbody tr')).to_have_count(4)

    def test_incident_role_ui_and_forged_actions_are_rejected(self):
        self.login('Engineer');self.route('incidents')
        expect(self.page.get_by_role('button',name='Добавить инцидент',exact=True)).to_be_visible()
        expect(self.page.get_by_role('button',name='Редактировать',exact=True)).to_have_count(4)
        expect(self.page.get_by_role('button',name='Удалить',exact=True)).to_have_count(0)
        self.page.get_by_role('button',name='Выйти',exact=True).click();self.login('Operator');self.route('incidents')
        expect(self.page.get_by_role('button',name='Добавить инцидент',exact=True)).to_have_count(0)
        self.page.evaluate("""()=>{const b=document.createElement('button');b.dataset.action='incident-edit';b.dataset.id='1';b.id='forged';document.querySelector('main').append(b);b.click()}""")
        expect(self.page.locator('#toast')).to_contain_text('прав')
        expect(self.page.locator('#incident-dialog')).to_have_count(0)

def load_tests(loader, tests, pattern):
    # Девять базовых тестов запускаются отдельно; унаследованные методы повторно не включаем.
    names=[n for n in StageTwoBrowser.__dict__ if n.startswith('test_')]
    return unittest.TestSuite(StageTwoBrowser(n) for n in names)

if __name__=='__main__':unittest.main(verbosity=2)
