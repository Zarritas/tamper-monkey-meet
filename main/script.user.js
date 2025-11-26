// ==UserScript==
// @name         Google Meet Imputación automática
// @namespace    http://tampermonkey.net/
// @version      2.2.2
// @description  Registra el tiempo del meet y genera la imputacion automaticamente
// @author       Jesus Lorenzo
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @match        https://meet.google.com/*
// @match        https://calendar.google.com/*
// @exclude      https://meet.google.com/landing
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @resource popup-css https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-imputar/refs/heads/main/main/css/style.css
// @resource css https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/css/style.css
// @resource bootstrap https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css
// @resource poppins https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-imputar/refs/heads/main/main/scripts/utils.js
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tampermonkey-odoo-rpc/refs/heads/main/OdooRPC.js
// @require      https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js
// @connect      *
// @updateURL    https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/script.user.js
// ==/UserScript==

(function () {
    'use strict';
    GM_addStyle(
        GM_getResourceText('css')
    )
    GM_addStyle(
        GM_getResourceText('popup-css')
    )
    const CONSTANTS = {
        STORAGE: {
            ODOO_URL: 'odoo_url',
            DB: 'db',
            DAILY_MEET: 'daily_meet',
            STATIC_URLS: 'url_static'
        },
        SELECTORS: {
            MEET: {
                START_BUTTON: '.XCoPyb',
                END_CALL_BUTTON: 'button[jsname="CQylAd"]',
                MEET_CONTAINER: 'div[jscontroller="mVP9bb"]',
                MEET_INFO: '.AzuXid.O2VjS',
                DESCRIPTION_SOURCE: 'div[jscontroller="XMlCJe"]',
                DESCRIPTION_ATTRIBUTE: 'data-meeting-title'
            },
            CALENDAR: {
                HANGUP_DIV: 'div.YWILgc.UcbTuf:not(.qdulke)',
                HANGUP_DIV_CREATE: 'div[jsname="I0Fcpe"]',
                HANGUP_DIV_SPECIFIC: '#xSaveBu',
                MEET_CONTAINER_1: '#xDetDlgVideo',
                MEET_CONTAINER_2: '[jsname="h2GoKe"]'
            }
        },
        CLASSES: {
            BTN_PRIMARY: 'btn-primary',
            BTN_SUCCESS: 'btn-success',
            BTN_DANGER: 'btn-danger',
            BTN_WARNING: 'btn-warning',
            BTN_INFO: 'btn-info'
        }
    };
    const UI = {
        create: (tag, id, classList, text = '') => {
            const element = document.createElement(tag);
            if (id) element.id = id;
            if (classList) element.className = classList;
            if (text) element.textContent = text;
            return element;
        },
        button: (id, text, classList, onClick) => {
            const btn = UI.create('button', id, classList, text);
            if (onClick) btn.addEventListener('click', onClick);
            return btn;
        },
        createInputBlock: (id, labelText, inputValue, inputClass, blockClass) => {
            const block = UI.create("div", `block-${id}`, blockClass);

            const label = UI.create("label", null, "input-group-text", labelText);
            label.setAttribute("for", id);
            label.style = "margin-top: 5px; justify-content: center; display:flex; align-items: center";
            block.appendChild(label);

            const input = UI.create('input', id, inputClass);
            input.value = inputValue || '';
            input.addEventListener('blur', () => {
                input.value = input.value.trim()
            });
            block.appendChild(input);

            if (inputClass.endsWith('new-url')) {
                const span_conf = UI.create('span', null, "input-group-text", '⚙️');
                span_conf.style = "margin-top: 5px;background: grey; cursor: pointer;"
                span_conf.addEventListener('click', async () => {
                    await createPopupStaticUrl()
                    setTimeout(() => {
                        showStatus(``, undefined, statusDiv)
                    }, 2000)
                })
                const span_del = UI.create('span', null, "input-group-text", '❌');
                span_del.style = "margin-top: 5px;background: #e35f5d; cursor: pointer;"
                span_del.addEventListener('click', async () => {
                    showStatus(`La url estatica ${id} borrada con exito`, "success", statusDiv)
                    Utils.cleanUrl(input.value);
                    block.remove()
                    setTimeout(() => {
                        showStatus(``, undefined, statusDiv)
                    }, 2000)
                })
                block.append(span_del, span_conf);
            }
            return block;
        },
        createTaskBlock: (id, labelText, inputClass, blockClass) => {
            const block = UI.create("div", `block-${id}`, blockClass);

            const label = UI.create("label", null, "input-group-text", labelText);
            label.setAttribute("for", id);
            label.style = "margin-top: 5px; justify-content: center; display:flex; align-items: center";

            let input = null
            if (id !== 'description') {
                input = UI.create("input", id, inputClass);
            } else {
                input = UI.create('textarea', id, inputClass);
            }

            const span_id = UI.create("span", `${id}-id`);
            span_id.style.display = 'none'

            block.appendChild(label);
            block.appendChild(input);
            block.appendChild(span_id);

            if (id !== 'description') {
                input.addEventListener("change", async function () {
                    let data = await getProyectOrTask.call(this)
                    span_id.innerText = data.id
                })
            }

            return block;
        }
    };
    const Utils = {
        toCamelCase: (text) => {
            return text
                .toLowerCase()
                .split(' ')
                .map((word, index) =>
                    index === 0
                        ? word
                        : word.charAt(0).toUpperCase() + word.slice(1)
                )
                .join('');
        },
        checkEndNumber: (hours) => {
            const wholeHours = Math.floor(hours);
            const decimalPart = hours - wholeHours;
            let mins = Math.round(decimalPart * 60);
            if (mins % 5 !== 0) {
                mins += (5 - (mins % 5));
                if (mins === 60) {
                    return wholeHours + 1;
                }
            }
            return wholeHours + (mins / 60);
        },
        cleanInfo: (elements) => {
            elements.forEach((element) => {
                element.value = ''
                element.textContent = ''
            })
        },
        clickButton: (element, text, fromClass, toClass, disabled = true) => {
            element.classList.add(toClass)
            element.classList.remove(fromClass)
            element.disabled = disabled
            element.innerText = text
        },
        cleanUrl: (value) => {
            let absolutes = GM_getValue(CONSTANTS.STORAGE.STATIC_URLS, []);
            const element_pos = absolutes.findIndex(item => item.value === value);
            if (element_pos === -1) return
            absolutes.splice(element_pos, 1);
            GM_setValue(CONSTANTS.STORAGE.STATIC_URLS, absolutes)
        }
    };
    const ErrorHandler = {
        handle: (error, context) => {
            console.error(`Error in ${context}:`, error);
            if (typeof showStatus === 'function' && statusDiv) {
                showStatus(`Error: ${error.message || error}`, "error", statusDiv);
            }
        }
    };
    let initialTime = null
    let task_id = null
    let description = null
    let project_id = null
    let statusDiv = null
    let saveButton = null
    let imputationButton = null
    let is_daily = false
    let observer = null
    let odooRPC = new OdooRPC(
        GM_getValue(CONSTANTS.STORAGE.ODOO_URL),
        GM_getValue(CONSTANTS.STORAGE.DB),
        {
            lang: "es_ES",
            tz: "Europe/Madrid",
        }
    )

    async function ensureAuth() {
        const auth = await odooRPC.authenticate();
        if (!await auth) {
            showStatus("¡¡No estas autenticado en odoo!!", "error", statusDiv);
        } else {
            showStatus("", undefined, statusDiv);
        }
        return auth;
    }

    async function setDailyReport() {
        if (!await ensureAuth()) return
        is_daily = true
        await setProjectAndTask("Temas internos", "Daily")
        document.getElementById('description').value = document.querySelector(CONSTANTS.SELECTORS.DESCRIPTION_SOURCE).getAttribute(CONSTANTS.SELECTORS.DESCRIPTION_ATTRIBUTE)
    }

    async function setRefinementReport() {
        if (!await ensureAuth()) return
        is_daily = false
        await setProjectAndTask("Temas internos", "Refinement")
        document.getElementById('description').value = document.querySelector(CONSTANTS.SELECTORS.DESCRIPTION_SOURCE).getAttribute(CONSTANTS.SELECTORS.DESCRIPTION_ATTRIBUTE).replace('Daily', 'Refinamiento')
    }

    async function setStaticUrlReport(element) {
        if (!await ensureAuth()) return
        is_daily = false
        await setProjectAndTask(element.project, element.task)
        document.getElementById('description').value = element.description
    }

    async function setProjectAndTask(project_name, task_name, is_static = false) {
        let project_temp_id = null
        project_id = await odooRPC.odooSearch(
            'project.project',
            [['name', 'ilike', project_name]],
            1,
            ['id', 'name']
        );
        let data = await project_id.records[0]
        if (!is_static) {
            project_id = data.id
            document.getElementById('project').value = data.name
            document.getElementById('project-id').innerText = data.id
        } else {
            project_temp_id = data.id
            document.getElementById('block-project').querySelector('input#project').value = data.name
            document.getElementById('block-project').querySelector('#project-id').innerText = data.id
        }
        task_id = await odooRPC.odooSearch(
            'project.task',
            [
                ['project_id', '=', project_temp_id || project_id],
                ['stage_id.closed', '=', false],
                ['name', 'ilike', task_name]
            ],
            1,
            ['id', 'name']
        );
        data = await task_id.records[0]
        if (!is_static) {
            task_id = data.id
            document.getElementById('task').value = data.name
            document.getElementById('task-id').innerText = data.id
        } else {
            document.getElementById('block-task').querySelector('input#task').value = data.name
            document.getElementById('block-task').querySelector('#task-id').innerText = data.id
        }
    }

    async function startTime() {
        const start_button = document.querySelector(CONSTANTS.SELECTORS.MEET.START_BUTTON);
        if (start_button) start_button.removeEventListener('click', startTime);
        initialTime = new Date();
        console.log(`Temporizador iniciado a las: ${initialTime.toLocaleTimeString()}`);
        try {
            setTimeout(() => {
                document.querySelector(CONSTANTS.SELECTORS.MEET.END_CALL_BUTTON).addEventListener('click', async () => {
                    try {
                        if (!project_id && !task_id && !description || await sendTimeTrackingData()) {
                            window.removeEventListener('beforeunload', beforeUnloadHandler)
                            return;
                        }
                    } catch (e) {
                        ErrorHandler.handle(e, 'sendTimeTrackingData');
                    }
                })
            }, 3000)
        } catch (e) {
            ErrorHandler.handle(e, 'startTime')
        }
    }

    async function configSettings() {
        GM_setValue(CONSTANTS.STORAGE.ODOO_URL, document.getElementById("odoo_url").value);
        GM_setValue(CONSTANTS.STORAGE.DB, document.getElementById("db").value);
        GM_setValue(CONSTANTS.STORAGE.DAILY_MEET, document.getElementById("daily").value);
        let static_urls = document.querySelectorAll('.new-url')
        static_urls.forEach((element) => {
            const absolutes = GM_getValue(CONSTANTS.STORAGE.STATIC_URLS)
            const elemento = absolutes.find(item => item.name === element.id)
            if (elemento) {
                elemento.value = element.value
            }
            GM_setValue(CONSTANTS.STORAGE.STATIC_URLS, absolutes)
        })
        const display_button = document.getElementById("display_imputation_buttom");
        odooRPC = new OdooRPC(
            GM_getValue(CONSTANTS.STORAGE.ODOO_URL),
            GM_getValue(CONSTANTS.STORAGE.DB),
            {
                lang: "es_ES",
                tz: "Europe/Madrid",
            }
        )
        Utils.clickButton(saveButton, 'Configuración guardada', CONSTANTS.CLASSES.BTN_PRIMARY, CONSTANTS.CLASSES.BTN_SUCCESS)
        const session = await ensureAuth()
        if (await session) await display_button.classList.remove(CONSTANTS.CLASSES.BTN_WARNING)
        else await display_button.classList.add(CONSTANTS.CLASSES.BTN_WARNING)
        setTimeout(() => {
            Utils.clickButton(saveButton, 'Guardar configuración', CONSTANTS.CLASSES.BTN_SUCCESS, CONSTANTS.CLASSES.BTN_PRIMARY, false)
        }, 1000)
    }

    async function getProyectOrTask() {
        if (!await ensureAuth()) {
            this.value = ''
            return;
        }
        const parent = this.parentElement.parentElement
        try {
            if (this.id === "project") {
                parent.querySelector('input#task').disabled = true;
                Utils.cleanInfo([
                    parent.querySelector('input#task'),
                    parent.querySelector('#task-id')
                ])
            }
            if (!this.value) {
                console.log(`${this.id} no encontrado`);
                Utils.cleanInfo([
                    parent.querySelector(`input#${this.id}`),
                    parent.querySelector(`#${this.id}-id`),
                    parent.querySelector("#description")
                ])
                return;
            }
            let domain = [
                ['name', 'ilike', this.value]
            ];
            if (this.id == "task" || this.id == "new-task") {
                domain.push(['stage_id.closed', '=', false]);
                if (!parent.querySelector('#project-id').textContent) {
                    console.log("rellenar el proyecto primero");
                    this.value = ''
                    return;
                };
                domain.push(["project_id", "=", project_id]);
            };
            const response = await odooRPC.odooSearch(
                `project.${this.id}`,
                domain,
                1,
                ['id', "name"]
            );
            const data = await response.records[0];
            if (!data) {
                return;
            };

            this.value = data.name;
            if (this.id === 'project') project_id = data.id
            if (this.id === 'task') task_id = data.id
            parent.querySelector('input#task').disabled = false
            return data
        } catch (e) {
            showStatus(`${this.id} no encontrado`, "error", statusDiv)
            ErrorHandler.handle(e, 'getProyectOrTask')
            setTimeout(() => {
                showStatus(``, undefined, statusDiv)
            }, 2000)
        }
    }

    async function stopAndStartNewImputation() {
        let susscess = await sendTimeTrackingData()
        setTimeout(() => {
            Utils.clickButton(imputationButton, text_button, (susscess) ? CONSTANTS.CLASSES.BTN_SUCCESS : CONSTANTS.CLASSES.BTN_DANGER, CONSTANTS.CLASSES.BTN_PRIMARY, false)
        }, 1000)
        if (!susscess) return
        Utils.cleanInfo([
            document.getElementById('description'),
            document.getElementById('task-id'),
            document.getElementById('task'),
            document.getElementById('project-id'),
            document.getElementById('project'),
        ])
        initialTime = new Date();
        console.log(`Nuevo Temporizador iniciado a las: ${initialTime.toLocaleTimeString()}`);
        let text_button = "Imputar"
        if (is_daily) {
            setRefinementReport();
            text_button = "Imputar y empezar otra tarea"
        }
        imputationButton.innerText = text_button
    }

    async function sendTimeTrackingData() {
        description = document.getElementById('description').value;
        if (!project_id) {
            showStatus("Proyecto incorrecto", "error", statusDiv)
            Utils.clickButton(imputationButton, 'Error al imputar', CONSTANTS.CLASSES.BTN_PRIMARY, CONSTANTS.CLASSES.BTN_DANGER)
            setTimeout(() => {
                showStatus("", undefined, statusDiv)
                Utils.clickButton(imputationButton, 'Imputar', CONSTANTS.CLASSES.BTN_DANGER, CONSTANTS.CLASSES.BTN_PRIMARY, false)
            }, 2000)
            return false;
        }
        if (!task_id) {
            showStatus("Tarea incorrecta", "error", statusDiv)
            Utils.clickButton(imputationButton, 'Error al imputar', CONSTANTS.CLASSES.BTN_PRIMARY, CONSTANTS.CLASSES.BTN_DANGER)
            setTimeout(() => {
                showStatus("", undefined, statusDiv)
                Utils.clickButton(imputationButton, 'Imputar', CONSTANTS.CLASSES.BTN_DANGER, CONSTANTS.CLASSES.BTN_PRIMARY, false)
            }, 2000)
            return false;
        }
        if (!description) {
            showStatus("La descripción es obligatoria", "error", statusDiv)
            Utils.clickButton(imputationButton, 'Error al imputar', CONSTANTS.CLASSES.BTN_PRIMARY, CONSTANTS.CLASSES.BTN_DANGER)
            setTimeout(() => {
                showStatus("", undefined, statusDiv)
                Utils.clickButton(imputationButton, 'Imputar', CONSTANTS.CLASSES.BTN_DANGER, CONSTANTS.CLASSES.BTN_PRIMARY, false)
            }, 2000)
            return false;
        }
        const endTime = new Date();
        const elapsedMilliseconds = endTime - initialTime;
        let elapsedHours = Math.round((elapsedMilliseconds / 3600000) * 100) / 100;
        elapsedHours = Utils.checkEndNumber(elapsedHours);
        console.log(`Tiempo total a imputar: ${formatDecimalToTime(elapsedHours)}.`);
        try {
            Utils.clickButton(imputationButton, 'Creando imputación ...', CONSTANTS.CLASSES.BTN_PRIMARY, CONSTANTS.CLASSES.BTN_INFO)
            await odooRPC.createTimesheetEntry(
                project_id,
                task_id,
                description,
                elapsedHours
            )
            Utils.clickButton(imputationButton, 'Imputación creada', CONSTANTS.CLASSES.BTN_INFO, CONSTANTS.CLASSES.BTN_SUCCESS)
            return true
        } catch (e) {
            Utils.clickButton(imputationButton, 'Error al imputar', CONSTANTS.CLASSES.BTN_PRIMARY, CONSTANTS.CLASSES.BTN_DANGER)
            ErrorHandler.handle(e, 'sendTimeTrackingData')
            return false
        }
    }

    async function createNewStaticUrl(meet_container) {
        const absolutes = GM_getValue(CONSTANTS.STORAGE.STATIC_URLS, [])
        const meet_endpoint = meet_container.querySelector(CONSTANTS.SELECTORS.MEET.MEET_INFO).textContent
        let element = absolutes.find(item => item.value === `https://${meet_endpoint}`)
        if (!element) element = { value: `https://${meet_endpoint}` }
        await createPopupStaticUrl(element)
    }

    async function createPopupStaticUrl(static_url = {}) {
        const overlay = UI.create("div", null, "timesheet-overlay config-overlay");
        const popup = UI.create('div', 'popup', 'timesheet-popup config-popup');
        const h3 = UI.create('h3', 'header', '', 'Config');
        const div_inputs = UI.create('div', 'div-inputs', 'timesheet-form-group');
        const input_name = UI.createInputBlock('new-name', 'Nombre: ', static_url.label || '', "task-config form-control", "input-group flex-nowrap mb-3");
        const input_url = UI.createInputBlock('url', 'URL: ', static_url.value || '', "task-config form-control", "input-group flex-nowrap mb-3");
        const input_project = UI.createTaskBlock('project', 'Proyecto: ', "task-config form-control", "input-group flex-nowrap mb-3");
        const input_task = UI.createTaskBlock('task', 'Tarea: ', "task-config form-control", "input-group flex-nowrap mb-3");
        const input_description = UI.createTaskBlock('description', 'Descripción: ', "task-config form-control", "input-group flex-nowrap mb-3")
        const div_buttons = UI.create('div', 'div-buttons', 'timesheet-buttons')
        const button_submit = UI.create('button', 'button-submit', 'timesheet-btn timesheet-btn-primary', '✅ Guardar')
        const button_cancel = UI.create('button', 'button-cancel', 'timesheet-btn timesheet-btn-secondary', '❌ Cancelar')
        statusDiv = UI.create('div', 'config-status', '')



        div_inputs.append(input_name, input_url, input_project, input_task, input_description)
        div_buttons.append(button_submit, button_cancel)
        popup.append(h3, div_inputs, div_buttons, statusDiv)
        document.body.append(overlay, popup)

        if (static_url.project && static_url.task) await setProjectAndTask(static_url.project, static_url.task, true);
        if (static_url.description) input_description.getElementsByTagName('textarea')[0].value = static_url.description;

        overlay.addEventListener("click", closeConfigPopup)
        button_submit.addEventListener("click", () => {
            let statics = GM_getValue("url_static", [])
            if (
                !input_name.getElementsByTagName('input')[0].value ||
                !input_project.getElementsByTagName('input')[0].value ||
                !input_url.getElementsByTagName('input')[0].value ||
                !input_task.getElementsByTagName('input')[0].value ||
                !input_description.getElementsByTagName('textarea')[0].value
            ) {
                showStatus('Todos los campos son obligatorios', 'error', statusDiv)
                return
            }
            if (statics.find(item => item.value === input_url.getElementsByTagName('input')[0].value)) {
                if (!confirm(`Ya existe una url estática para este meet\n¿Sobrescribir?`)) return
            }
            let values = {
                name: Utils.toCamelCase(input_name.getElementsByTagName('input')[0].value),
                label: input_name.getElementsByTagName('input')[0].value,
                value: input_url.getElementsByTagName('input')[0].value,
                project: input_project.getElementsByTagName('input')[0].value,
                task: input_task.getElementsByTagName('input')[0].value,
                description: input_description.getElementsByTagName('textarea')[0].value,
            }
            Utils.cleanUrl(values.value)
            statics = GM_getValue("url_static", [])
            statics.push(values)
            GM_setValue('url_static', statics)
            showStatus('Nueva url guardada', 'success', statusDiv)
            setTimeout(closeConfigPopup, 2000)
            if (location.origin === "https://meet.google.com") {
                let old_element = document.getElementById(`block-${values.name}`)
                if (old_element) old_element.remove()
                document.getElementById('url_config').appendChild(UI.createInputBlock(values.name, `URL meet ${values.label}`, values.value, "global-config form-control new-url", "input-group flex-nowrap mb-3"))

            }
        });
        button_cancel.addEventListener("click", closeConfigPopup);

    }

    function createImputationConfig() {
        const imputationConfig = UI.create("div", "imputation_config", "pt8HRc RTBkae");
        imputationConfig.style.top = "0px";
        imputationConfig.style.right = "0px";

        const display_button = UI.create('button', "display_imputation_buttom", "wX4xVc-Bz112c-LgbsSe wX4xVc-Bz112c-LgbsSe-OWXEXe-SfQLQb-suEOdc MNFoWc gP9Sgd lSuz7d");

        const icon = UI.create('span', 'imputation_icon', null, '📝');
        display_button.append(icon)

        const div_container = UI.create('div', "div_imputation_container");
        div_container.style.display = 'none'

        const title = UI.create("h3", null, "title", "Configuración de Imputación");

        const formTabs = UI.create("div", null, "form-tabs");

        const imputationInputs = UI.create("div", "imputation_inputs");

        const globalConfig = UI.create("div", "global_config", "form-section");

        const urlConfig = UI.create("div", "url_config", "form-section");
        urlConfig.style.maxHeight = "200px";
        urlConfig.style.overflow = "overlay";

        const taskConfig = UI.create("div", "task_config", "form-section active");

        const configTab = UI.create("div", "config-tab", "tab", "Configuración");

        const urlTab = UI.create("div", "url-tab", "tab", "URLs estáticas");

        const projectTaskTab = UI.create("div", "project-task-tab-tab", "tab active", "Imputación personalizada");

        const buttonConfig = UI.create("div", "button_config", "block-config");

        imputationButton = UI.create("button", 'save-imputation', "btn btn-primary");
        if (GM_getValue(CONSTANTS.STORAGE.DAILY_MEET) === location.origin + location.pathname) {
            imputationButton.textContent = "Imputar y empezar Refinamiento";
            imputationButton.addEventListener("click", stopAndStartNewImputation)
        } else {
            imputationButton.textContent = "Imputar";
            imputationButton.addEventListener("click", stopAndStartNewImputation)
        }

        saveButton = UI.create("button", 'save-config', "btn btn-primary", "Guardar configuración");
        saveButton.style.display = 'none';

        statusDiv = UI.create('div', "imputation-status");

        const div_footer = UI.create('div', "footer");
        const github = UI.create('a');
        github.href = "https://github.com/FlJesusLorenzo/tamper-monkey-meet";
        github.target = "_blank";
        github.style.color = "black";
        const foot_img = UI.create('img');
        foot_img.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/GitHub_Invertocat_Logo.svg/1024px-GitHub_Invertocat_Logo.svg.png"
        foot_img.width = '20'
        const by_name = UI.create('span', null, null, 'by Jesús Lorenzo');

        const add_static_url = UI.create('button', 'add-url', "btn btn-primary", "Agregar nueva URL");
        urlConfig.appendChild(add_static_url)

        globalConfig.appendChild(UI.createInputBlock("odoo_url", "URL Odoo: ", GM_getValue(CONSTANTS.STORAGE.ODOO_URL), "global-config form-control", "input-group flex-nowrap mb-3"));
        globalConfig.appendChild(UI.createInputBlock("db", "Base de datos: ", GM_getValue(CONSTANTS.STORAGE.DB), "global-config form-control", "input-group flex-nowrap mb-3"));
        globalConfig.appendChild(UI.createInputBlock("daily", "URL meet daily: ", GM_getValue(CONSTANTS.STORAGE.DAILY_MEET), "global-config form-control", "input-group flex-nowrap mb-3"));
        GM_getValue(CONSTANTS.STORAGE.STATIC_URLS, []).forEach((element) => {
            urlConfig.appendChild(UI.createInputBlock(element.name, `URL meet ${element.label}`, element.value, "global-config form-control new-url", "input-group flex-nowrap mb-3"));
        })

        taskConfig.appendChild(UI.createTaskBlock("project", "Proyecto: ", "task-config form-control", "input-group flex-nowrap mb-3"));
        taskConfig.appendChild(UI.createTaskBlock("task", "Tarea: ", "task-config form-control", "input-group flex-nowrap mb-3"));
        taskConfig.appendChild(UI.createTaskBlock("description", "Descripción: ", "task-config form-control", "input-group flex-nowrap mb-3"))

        github.append(foot_img, by_name)
        div_footer.append(github)
        buttonConfig.append(imputationButton, saveButton);
        formTabs.append(projectTaskTab, configTab, urlTab)
        imputationInputs.append(formTabs, globalConfig, taskConfig, urlConfig);
        div_container.append(title, imputationInputs, statusDiv, buttonConfig, div_footer);
        imputationConfig.append(display_button, div_container)

        display_button.addEventListener("click", () => {
            if (document.getElementById('project-id').textContent === '') {
                document.getElementById('task').disabled = true
            } else {
                document.getElementById('task').disabled = false
            }
            if (div_container.style.display === 'none') {
                div_container.style.display = "flex"
                imputationConfig.style.background = "white";
                imputationConfig.style.position = 'absolute';
                icon.innerText = '⚙️'
                return;
            }
            div_container.style.display = 'none';
            imputationConfig.style.background = "none";
            imputationConfig.style.position = 'relative';
            icon.innerText = '📝'
        })
        saveButton.addEventListener("click", configSettings)
        configTab.addEventListener("click", () => {
            let activeTab = document.querySelector(".tab.active")
            let activeConfig = document.querySelector(".form-section.active")
            if (configTab === activeTab) return
            switchTab(configTab, activeTab, globalConfig, activeConfig);
            saveButton.style.display = '';
        });
        projectTaskTab.addEventListener("click", () => {
            let activeTab = document.querySelector(".tab.active")
            let activeConfig = document.querySelector(".form-section.active")
            if (projectTaskTab === activeTab) return
            switchTab(projectTaskTab, activeTab, taskConfig, activeConfig);
            saveButton.style.display = 'none';
            if (document.getElementById('project-id').textContent === '') {
                document.getElementById('task').disabled = true
            } else {
                document.getElementById('task').disabled = false
            }
        });
        urlTab.addEventListener("click", () => {
            let activeTab = document.querySelector(".tab.active")
            let activeConfig = document.querySelector(".form-section.active")
            if (urlTab === activeTab) return
            switchTab(urlTab, activeTab, urlConfig, activeConfig);
            saveButton.style.display = '';
        });
        add_static_url.addEventListener('click', async () => {
            await createPopupStaticUrl()
            setTimeout(() => {
                showStatus(``, undefined, statusDiv)
            }, 2000)
        })

        if (!GM_getValue(CONSTANTS.STORAGE.ODOO_URL) || GM_getValue(CONSTANTS.STORAGE.ODOO_URL) === '') {
            switchTab(configTab, projectTaskTab, globalConfig, taskConfig);
            saveButton.style.display = '';
            display_button.style.backgroundColor = "#ffc107"
        }

        return imputationConfig;
    }

    function closeConfigPopup() {
        const overlay = document.querySelector(".config-overlay");
        const popup = document.querySelector(".config-popup");
        if (overlay) overlay.remove();
        if (popup) popup.remove();
    }

    function startObserver() {
        observer.observe(document.body, { childList: true, subtree: true });
        if (this) this.removeEventListener("click", startObserver);
    }

    function beforeUnloadHandler(e) {
        e.preventDefault();
        e.returnValue = '';
        popupForRemainingInfo();
    }

    function popupForRemainingInfo() {
        const overlay = UI.create("div", null, "timesheet-overlay config-overlay");
        const popup = UI.create('div', 'popup', 'timesheet-popup config-popup');
        const h3 = UI.create('h3', 'header', '', 'Set remaining info');
        const div_inputs = UI.create('div', 'div-inputs', 'timesheet-form-group');
        const input_project = UI.createTaskBlock('project', 'Proyecto: ', "task-config form-control", "input-group flex-nowrap mb-3");
        const input_task = UI.createTaskBlock('task', 'Tarea: ', "task-config form-control", "input-group flex-nowrap mb-3");
        const input_description = UI.createTaskBlock('description', 'Descripción: ', "task-config form-control", "input-group flex-nowrap mb-3");
        const div_buttons = UI.create('div', 'div-buttons', 'timesheet-buttons');
        const button_submit = UI.create('button', 'button-submit', 'timesheet-btn timesheet-btn-primary', '✅ Guardar');
        const button_cancel = UI.create('button', 'button-cancel', 'timesheet-btn timesheet-btn-secondary', '❌ Cancelar');
        div_inputs.append(input_project, input_task, input_description);
        div_buttons.append(button_submit, button_cancel);
        popup.append(h3, div_inputs, div_buttons);
        overlay.append(popup);
        document.body.appendChild(overlay);
        button_cancel.addEventListener('click', () => {
            overlay.remove();
            popup.remove();
            window.removeEventListener('beforeunload', beforeUnloadHandler)
        });
        button_submit.addEventListener('click', async () => {
            project_id = input_project.value;
            task_id = input_task.value;
            description = input_description.value;
            await sendTimeTrackingData()
            overlay.remove();
            popup.remove();
            window.removeEventListener('beforeunload', beforeUnloadHandler)
        });
    }

    if (location.origin == "https://meet.google.com") {
        observer = new MutationObserver(() => {
            const container = document.querySelector(CONSTANTS.SELECTORS.MEET.MEET_CONTAINER)
            const new_div = document.getElementById('imputation_config')

            if (!container || new_div) return;



            const static_urls = GM_getValue(CONSTANTS.STORAGE.STATIC_URLS, [])
            container.parentElement.appendChild(createImputationConfig());
            let element = static_urls.find(item => item.value === location.origin + location.pathname);
            if (location.origin + location.pathname === GM_getValue(CONSTANTS.STORAGE.DAILY_MEET)) {
                setDailyReport();
            } else if (element) {
                setStaticUrlReport(element);
            };
            window.addEventListener('beforeunload', beforeUnloadHandler)
            console.info("Agregado evento para cancelar el cierre de la pestaña.")
        });

        GM_addStyle(
            GM_getResourceText('bootstrap')
        )
        GM_addStyle(
            GM_getResourceText('poppins')
        )
        window.addEventListener('load', () => {
            const button = document.querySelector(CONSTANTS.SELECTORS.MEET.START_BUTTON);
            if (button) button.addEventListener('click', startTime);
            else startTime();
        });
        startObserver()
    }
    if (location.origin == "https://calendar.google.com") {
        observer = new MutationObserver(() => {
            let button = null
            let div = null
            const hangupDiv = document.querySelector(CONSTANTS.SELECTORS.CALENDAR.HANGUP_DIV);
            const hungupDiv_create = document.querySelector(CONSTANTS.SELECTORS.CALENDAR.HANGUP_DIV_CREATE);
            const hangupDiv_specific_event = document.querySelector(CONSTANTS.SELECTORS.CALENDAR.HANGUP_DIV_SPECIFIC);
            const new_div = document.getElementById('static_url_button')

            if (new_div) return;

            if (hangupDiv) {
                div = UI.create('div', 'static_url_container', '"VfPpkd-dgl2Hf-ppHlrf-sM5MNb')
                button = UI.create('button', 'static_url_button', 'AeBiU-LgbsSe AeBiU-LgbsSe-OWXEXe-dgl2Hf AeBiU-kSE8rc-FoKg4d-sLO9V-YoZ4jf nWxfQb')
                button.appendChild(UI.create('span', 'static_url_button_text', 'AeBiU-vQzf8d', 'Datos de tarea'))
                div.appendChild(button)
                hangupDiv.appendChild(div)
                button.addEventListener('click', async () => {
                    const meet_container = document.querySelector(CONSTANTS.SELECTORS.CALENDAR.MEET_CONTAINER_1)
                    if (!meet_container) {
                        alert("No hay reunión de meet creada, debes crear una antes de agregar los datos")
                        return;
                    }
                    await createNewStaticUrl(meet_container)
                });
            } else if (hungupDiv_create) {
                button = UI.create('button', 'static_url_button', 'nUt0vb zmrbhe qs41qe')
                button.appendChild(UI.create('span', 'url_static_span_style_1', 'UTNHae'))
                button.appendChild(UI.create('span', 'url_static_span_style_2', 'XjoK4b SIr0ye'))
                button.appendChild(UI.create('div', 'url_static_div_text', 'x5FT4e kkUTBb', 'Datos de tarea'))
                hungupDiv_create.appendChild(button)
                button.addEventListener('click', async () => {
                    const meet_container = document.querySelector(CONSTANTS.SELECTORS.CALENDAR.MEET_CONTAINER_2)
                    if (!meet_container) {
                        alert("No hay reunión de meet creada, debes crear una antes de agregar los datos")
                        return;
                    }
                    await createNewStaticUrl(meet_container)
                });
            } else if (hangupDiv_specific_event) {
                button = UI.create('button', 'static_url_button', 'UywwFc-LgbsSe UywwFc-StrnGf-YYd4I-VtOx3e UywwFc-kSE8rc-FoKg4d-sLO9V-YoZ4jf guz9kb')
                button.appendChild(UI.create('span', 'url_static_span_style_1', 'XjoK4b'))
                button.appendChild(UI.create('span', 'url_static_span_style_2', 'MMvswb'))
                button.appendChild(UI.create('span', 'url_static_span_style_3', 'UTNHae'))
                button.appendChild(UI.create('span', 'url_static_span_style_4', 'UywwFc-kBDsod-Rtc0Jf UywwFc-kBDsod-Rtc0Jf-OWXEXe-M1Soyc'))
                button.appendChild(UI.create('span', 'url_static_span_style_5', 'UywwFc-vQzf8d', 'Datos de tarea'))
                button.appendChild(UI.create('span', 'url_static_span_style_5', 'UywwFc-kBDsod-Rtc0Jf UywwFc-kBDsod-Rtc0Jf-OWXEXe-UbuQg'))
                hangupDiv_specific_event.parentElement.appendChild(button)
                button.addEventListener('click', async () => {
                    const meet_container = document.querySelector(CONSTANTS.SELECTORS.CALENDAR.MEET_CONTAINER_2)
                    if (!meet_container) {
                        alert("No hay reunión de meet creada, debes crear una antes de agregar los datos")
                        return;
                    }
                    await createNewStaticUrl(meet_container)
                });
            } else {
                return
            }

            statusDiv = document.createElement('div')
            statusDiv.style.zIndex = '99999999'
            document.body.appendChild(statusDiv)
        });

        startObserver()
    }
})();
