// ==UserScript==
// @name         Google Meet Imputación automática
// @namespace    http://tampermonkey.net/
// @version      1.3.0
// @description  Registra el tiempo del meet y genera la imputacion automaticamente
// @author       Jesus Lorenzo
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @match        https://meet.google.com/*
// @exclude      https://meet.google.com/landing
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @resource css https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/css/style.css
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-imputar/refs/heads/main/main/scripts/utils.js
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tampermonkey-odoo-rpc/refs/heads/main/OdooRPC.js
// @connect      *
// @updateURL    https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/script.user.js
// ==/UserScript==

(function() {
    'use strict';
    GM_addStyle(
        GM_getResourceText('css')
    )
    let initialTime = null
    let odooRPC = new OdooRPC(
        GM_getValue("odoo_url"),
        GM_getValue("db"),
        {
            lang: "es_ES",
            tz: "Europe/Madrid",
        }
    )
    let task_id = null
    let description = null
    let project_id = null

    function cleanInfo(elements){
        elements.forEach((element)=>{
            element.value = ''
            element.textContent = ''
        })
    }

    async function setDailyReport(){
        document.getElementById('description').textContent = document.querySelector('div[jsname="NeC6gb"]').textContent
        await setProjectAndTask("Temas internos", "Daily")
    }

    async function setRefinementReport(){
        document.getElementById('description').textContent = document.querySelector('div[jsname="NeC6gb"]').textContent.replace('Daily', 'Refinamiento')
        await setProjectAndTask("Temas internos", "Refinement")
    }

    async function setProjectAndTask(project_name, task_name){
        project_id = await odooRPC.odooSearch(
            'project.project',
            [['name','ilike', project_name]],
            1,
            ['id','name']
        );
        document.getElementById('project').value = await project_id.records[0].name
        document.getElementById('project-id').innerText = project_id = await project_id.records[0].id
        task_id = await odooRPC.odooSearch(
            'project.task',
            [
                ['project_id','=',project_id],
                ['stage_id.closed','=',false],
                ['name','ilike',task_name]
            ],
            1,
            ['id','name']
        );
        document.getElementById('task').value = await task_id.records[0].name
        document.getElementById('task-id').innerText = await task_id.records[0].id
    }

    async function startTime(){
        const start_button = document.querySelector('.XCoPyb');
        if (start_button) start_button.removeEventListener('click', startTime);
        initialTime = new Date();
        console.log(`Temporizador iniciado a las: ${initialTime.toLocaleTimeString()}`);
        try{
            setTimeout(()=>{
                document.querySelector('button[jsname="CQylAd"]').addEventListener('click', sendTimeTrackingData)
                document.querySelector('div[jsname="ys7RQc"]').parentElement.appendChild(createImputationConfig());
                if (location.origin + location.pathname === GM_getValue('daily_meet')){
                    setDailyReport();
                } else if (location.origin + location.pathname === GM_getValue('refinement_meet')){
                    setRefinementReport();
                };
            }, 5000)
        } catch(e){
            console.log(`Error ${e}`)
        }
    }

    function stopAndStartNewImputation(){
        sendTimeTrackingData();
        initialTime = new Date();
        console.log(`Nuevo Temporizador iniciado a las: ${initialTime.toLocaleTimeString()}`);
        if (location.origin + location.pathname === GM_getValue('daily_meet')){
            setRefinementReport();
            document.getElementById('save-imputation').innerText = "Imputar y empezar otra tarea"
        }
    }

    function checkEndNumber(hours){
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
    }

    function sendTimeTrackingData() {
        const endTime = new Date();
        const elapsedMilliseconds = endTime - initialTime;
        let elapsedHours = Math.round((elapsedMilliseconds / 3600000)*100)/100;
        elapsedHours = checkEndNumber(elapsedHours);
        project_id = parseInt(document.getElementById('project-id').textContent)
        task_id = parseInt(document.getElementById('task-id').textContent)
        description = document.getElementById('description').value;
        if (!project_id || !task_id){
            clickButton(document.getElementById('save-imputation'),'Error al imputar','btn-primary','btn-danger')
            return;
        }
        console.log(`Tiempo total a imputar: ${formatDecimalToTime(elapsedHours)}.`);
        try {
            odooRPC.createTimesheetEntry(
                project_id,
                task_id,
                description,
                elapsedHours
            )
            clickButton(document.getElementById('save-imputation'),'Imputación creada','btn-primary','btn-success')
            cleanInfo([
                document.getElementById('description'),
                document.getElementById('task-id'),
                document.getElementById('task'),
                document.getElementById('project-id'),
                document.getElementById('project'),
            ])
        } catch {
            clickButton(document.getElementById('save-imputation'),'Error al imputar','btn-primary','btn-danger')
        }
    }

    async function getProyectOrTask(){
        if (!this.value){
            console.log(`${this.id} no encontrado`);
            document.getElementById(`${this.id}-id`).innerText = '';
            if (this.id === "project"){
                document.getElementById('task').disabled = true;
                document.getElementById('task').value = '';
                document.getElementById('task-id').innerText = '';
            }
            return;
        }
        let domain = [
            ['name','ilike',this.value]
        ];
        if (this.id == "task"){
            domain.push(['stage_id.closed','=',false]);
            if (!document.getElementById('project-id').textContent){
                console.log("rellenar el proyecto primero");
                this.value = ''
                return;
            };
            domain.push(["project_id","=",parseInt(document.getElementById('project-id').textContent)]);
        };
        const response = await odooRPC.odooSearch(
            `project.${this.id}`,
            domain,
            1,
            ['id', "name"]
        );
        const data = await response.records[0];
        if (!data){
            return;
        };
        document.getElementById(`${this.id}-id`).innerText = data.id;
        this.value = data.name;
        document.getElementById('task').disabled = false
    }

    function createImputationConfig() {
        const imputationConfig = document.createElement("div");
        imputationConfig.id = "imputation_config";
        imputationConfig.classList = "pt8HRc RTBkae";

        const display_buttom = document.createElement('buttom');
        display_buttom.id = "display_imputation_buttom";
        display_buttom.classList = "wX4xVc-Bz112c-LgbsSe wX4xVc-Bz112c-LgbsSe-OWXEXe-SfQLQb-suEOdc MNFoWc gP9Sgd lSuz7d";

        const icon = document.createElement('span')
        icon.id = 'imputation_icon'
        icon.innerText = '📝'
        display_buttom.append(icon)

        const div_container = document.createElement('div')
        div_container.id = "div_imputation_container";
        div_container.style.display = 'none'

        const title = document.createElement("h3");
        title.innerText = "Configuración de Imputación";
        title.classList = "title";

        const formTabs = document.createElement("div");
        formTabs.classList = "form-tabs";

        const imputationInputs = document.createElement("div");
        imputationInputs.id = "imputation_inputs";

        const globalConfig = document.createElement("div");
        globalConfig.id = "global_config";
        globalConfig.classList = "form-section";

        const taskConfig = document.createElement("div");
        taskConfig.id = "task_config";
        taskConfig.classList = "form-section active";

        const configTab = document.createElement("div");
        configTab.classList = "tab";
        configTab.id = "config-tab";
        configTab.innerText = "Configuración";

        const projectTaskTab = document.createElement("div");
        projectTaskTab.classList = "tab active";
        projectTaskTab.id = "project-task-tab-tab";
        projectTaskTab.innerText = "Imputación personalizada";

        function createInputBlock(id, labelText, inputValue, inputClass, blockClass) {
            const block = document.createElement("div");
            block.id = `block-${id}`;
            block.classList = blockClass;

            const label = document.createElement("label");
            label.setAttribute("for", id);
            label.textContent = labelText;

            const input = document.createElement("input");
            input.id = id;
            input.classList = inputClass;
            input.value = inputValue || '';

            block.appendChild(label);
            block.appendChild(input);
            if (id === "odoo_url"){
                input.addEventListener("blur", ()=>{
                    odooRPC.authenticate();
                })
            };

            return block;
        };

        globalConfig.appendChild(createInputBlock("odoo_url", "URL Odoo: ", GM_getValue("odoo_url"), "global-config", "block-config"));
        globalConfig.appendChild(createInputBlock("db", "Base de datos: ", GM_getValue("db"), "global-config", "block-config"));
        globalConfig.appendChild(createInputBlock("daily_meet", "URL Meet Daily: ", GM_getValue("daily_meet"), "global-config", "block-config"));
        globalConfig.appendChild(createInputBlock("refinement_meet", "URL Meet Refinamiento: ", GM_getValue("refinement_meet"), "global-config", "block-config"));

        function createTaskBlock(id, labelText, inputClass, blockClass) {
            const block = document.createElement("div");
            block.id = `block-${id}`;
            block.classList = blockClass

            const label = document.createElement("label");
            label.setAttribute("for", id);
            label.textContent = labelText;

            let input = null
            if (id !== 'description'){
                input = document.createElement("input");
            } else {
                input = document.createElement('textarea')
            }

            input.id = id;
            input.classList = inputClass;

            const span_id = document.createElement("span");
            span_id.id = `${id}-id`;
            span_id.style = "display: none;"

            block.appendChild(label);
            block.appendChild(input);
            block.appendChild(span_id);

            input.addEventListener("change", getProyectOrTask)

            return block;
        }

        taskConfig.appendChild(createTaskBlock("project","Proyecto: ","task-config", "block-config"));
        taskConfig.appendChild(createTaskBlock("task","Tarea: ","task-config", "block-config"));
        taskConfig.appendChild(createTaskBlock("description","Descripción: ", "task-config", "block-config"))


        const buttonConfig = document.createElement("div");
        buttonConfig.id = "button_config";
        buttonConfig.classList = "block-config"

        const buttonImputar = document.createElement("button");
        buttonImputar.id = 'save-imputation'
        if (GM_getValue("daily_meet") === location.origin + location.pathname){
            buttonImputar.textContent = "Imputar y empezar Refinamiento";
            buttonImputar.addEventListener("click", stopAndStartNewImputation)
        } else if (GM_getValue("refinement_meet") === location.origin + location.pathname){
            buttonImputar.textContent = "Imputar y empezar otra tarea";
            buttonImputar.addEventListener("click", stopAndStartNewImputation)
        } else {
            buttonImputar.textContent = "Imputar";
            buttonImputar.addEventListener("click", stopAndStartNewImputation)
        }

        buttonImputar.classList = "btn btn-primary"

        const buttonGuardar = document.createElement("button");
        buttonGuardar.id = 'save-config'
        buttonGuardar.textContent = "Guardar configuración";
        buttonGuardar.classList = "btn btn-primary"
        buttonGuardar.style.display = 'none';

        buttonConfig.append(buttonImputar, buttonGuardar);
        formTabs.append(projectTaskTab, configTab)
        imputationInputs.append(formTabs, globalConfig, taskConfig);
        div_container.append(title, imputationInputs, buttonConfig);
        imputationConfig.append(display_buttom,div_container)

        display_buttom.addEventListener("click", ()=>{
            if (document.getElementById('project-id').textContent === ''){
                document.getElementById('task').disabled = true
            } else {
                document.getElementById('task').disabled = false
            }
            if (div_container.style.display === 'none'){
                div_container.style.display = "flex"
                imputationConfig.style.background = "white";
                icon.innerText = '⚙️'
                return;
            }
            div_container.style.display = 'none';
            imputationConfig.style.background = "none";
            icon.innerText = '📝'
        })
        buttonGuardar.addEventListener("click", configSettings)
        configTab.addEventListener("click", () => {
            switchTab(configTab, projectTaskTab, globalConfig, taskConfig);
            buttonGuardar.style.display = '';
        });
        projectTaskTab.addEventListener("click", () => {
            switchTab(projectTaskTab, configTab, taskConfig, globalConfig);
            buttonGuardar.style.display = 'none';
            if (document.getElementById('project-id').textContent === ''){
                document.getElementById('task').disabled = true
            } else {
                document.getElementById('task').disabled = false
            }
        });

        if (GM_getValue("odoo_url") === '') {
            switchTab(configTab, projectTaskTab, globalConfig, taskConfig);
            buttonGuardar.style.display = '';
            display_buttom.classList.add('btn-warning')
        }

        return imputationConfig;
    }

    function clickButton(element, text, fromClass, toClass){
        element.classList.add(toClass)
        element.classList.remove(fromClass)
        element.disabled = true
        let backup_text = element.innerText
        element.innerText = text
        setTimeout(()=>{
            element.classList.remove(toClass)
            element.classList.add(fromClass)
            element.disabled = false
            element.innerText = backup_text
        },1000)
    }

    async function configSettings(){
        GM_setValue('odoo_url', document.getElementById("odoo_url").value)
        GM_setValue('db', document.getElementById("db").value)
        GM_setValue('daily_meet', document.getElementById("daily_meet").value)
        GM_setValue('refinement_meet', document.getElementById("refinement_meet").value)
        const button = document.getElementById("save-config");
        const display_button = document.getElementById("display_imputation_buttom");
        odooRPC = new OdooRPC(
            GM_getValue("odoo_url"),
            GM_getValue("db"),
            {
                lang: "es_ES",
                tz: "Europe/Madrid",
            }
        )
        clickButton(button, 'Configuración guardada','btn-primary','btn-success')
        const session = await odooRPC.authenticate();
        if (await session) await display_button.classList.remove('btn-warning')
        else await display_button.classList.add('btn-warning')
    }

    window.addEventListener('load', () => {
        const button = document.querySelector('.XCoPyb');
        if (button)button.addEventListener('click', startTime);
        else startTime();
    });
})();
