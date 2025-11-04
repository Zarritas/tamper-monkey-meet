// ==UserScript==
// @name         Google Meet Imputación automática
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  Registra el tiempo del meet y genera la imputacion automaticamente
// @author       Jesus Lorenzo
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @match        https://meet.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @resource css https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/css/style.css
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-imputar/refs/heads/main/main/scripts/utils.js
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tampermonkey-odoo-rpc/refs/heads/main/OdooRPC.js
// @updateURL   https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/script.user.js
// @downloadURL https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/script.user.js
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

    async function setDailyReport(){
        description = document.getElementById('description')
        description.textContent = description.value = document.querySelector('div[jsname="NeC6gb"]').textContent.split(' ').slice(0,2).join(' ')
        await setProjectAndTask("Temas internos", "Daily")
    }

    async function setRefinementReport(){
        description = document.getElementById('description')
        description.textContent = description.value = document.querySelector('div[jsname="NeC6gb"]').textContent.split(' ').slice(0,2).join(' ').replace('Daily', 'Refinamiento')
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
        initialTime = new Date();
        console.log(`Temporizador iniciado a las: ${initialTime.toLocaleTimeString()}`);
        try{
            setTimeout(()=>{
                document.querySelector('button[jsname="CQylAd"]').addEventListener('click', sendTimeTrackingData)
                document.body.appendChild(createImputationConfig());
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
        if (location.origin + location.pathname === GM_getValue('daily_meet')){
            setRefinementReport();
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
        description = document.getElementById('description').textContent
        console.log(`Tiempo total a imputar: ${formatDecimalToTime(elapsedHours)}.`);
        odooRPC.createTimesheetEntry(
            project_id,
            task_id,
            description,
            elapsedHours
        )
    }

    async function getProyectOrTask(){
        if (!this.value){
            console.log(`${this.id} no encontrado`);
            document.getElementById(`${this.id}-id`).innerText = '';
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
    }

    function createImputationConfig() {
        const imputationConfig = document.createElement("div");
        imputationConfig.id = "imputation_config";


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
        globalConfig.appendChild(createInputBlock("daily_meet", "URL meet daily: ", GM_getValue("daily_meet"), "global-config", "block-config"));
        globalConfig.appendChild(createInputBlock("refinement_meet", "URL meet refinement: ", GM_getValue("refinement_meet"), "global-config", "block-config"));

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

        imputationInputs.append(globalConfig, taskConfig);

        const buttonConfig = document.createElement("div");
        buttonConfig.id = "button_config";
        buttonConfig.classList = "block-config"

        const buttonImputar = document.createElement("button");
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
        buttonGuardar.textContent = "Guardar configuración";
        buttonGuardar.classList = "btn btn-primary"

        buttonConfig.append(buttonImputar, buttonGuardar);
        formTabs.append(projectTaskTab, configTab)

        imputationConfig.append(title, formTabs, imputationInputs, buttonConfig);
        buttonGuardar.addEventListener("click", configSettings)
        configTab.addEventListener("click", () => {
            switchTab(configTab, projectTaskTab, globalConfig, taskConfig);
        });
        projectTaskTab.addEventListener("click", () => {
            switchTab(projectTaskTab, configTab, taskConfig, globalConfig);
        });

        return imputationConfig;
    }

    function configSettings(){
        GM_setValue('odoo_url', document.getElementById("odoo_url").value)
        GM_setValue('db', document.getElementById("db").value)
        GM_setValue('daily_meet', document.getElementById("daily_meet").value)
        GM_setValue('refinement_meet', document.getElementById("refinement_meet").value)
        odooRPC = new OdooRPC(
            GM_getValue("odoo_url"),
            GM_getValue("db"),
            {
                lang: "es_ES",
                tz: "Europe/Madrid",
            }
        )
        odooRPC.authenticate();
    }

    window.addEventListener('load', () => {
        document.querySelector('.XCoPyb').addEventListener('click', startTime)
    });
})();
