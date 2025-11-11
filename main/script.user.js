// ==UserScript==
// @name         Google Meet Imputación automática
// @namespace    http://tampermonkey.net/
// @version      1.5.0
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
// @resource bootstrap https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css
// @resource poppins https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-imputar/refs/heads/main/main/scripts/utils.js
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tampermonkey-odoo-rpc/refs/heads/main/OdooRPC.js
// @require      https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js
// @connect      *
// @updateURL    https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/script.user.js
// ==/UserScript==

(function() {
    'use strict';
    GM_addStyle(
        GM_getResourceText('css')
    )
    GM_addStyle(
        GM_getResourceText('bootstrap')
    )
    GM_addStyle(
        GM_getResourceText('poppins')
    )
    let odooRPC = new OdooRPC(
        GM_getValue("odoo_url"),
        GM_getValue("db"),
        {
            lang: "es_ES",
            tz: "Europe/Madrid",
        }
    )
    let initialTime = null
    let task_id = null
    let description = null
    let project_id = null
    let statusDiv = null
    let saveButton = null
    let imputationButton = null

    function cleanInfo(elements){
        elements.forEach((element)=>{
            element.value = ''
            element.textContent = ''
        })
    }

    function clickButton(element, text, fromClass, toClass, disabled=true){
        element.classList.add(toClass)
        element.classList.remove(fromClass)
        element.disabled = disabled
        element.innerText = text
    }

    async function ensureAuth(){
        const auth = await odooRPC.authenticate();
        if (!await auth){
            showStatus("¡¡No estas autenticado en odoo!!", "error", statusDiv);
        }else{
            showStatus("", undefined, statusDiv);
        }
        return auth;
    }

    async function setDailyReport(){
        if (!await ensureAuth()) return
        document.getElementById('description').value = document.querySelector('div[jsname="NeC6gb"]').textContent
        await setProjectAndTask("Temas internos", "Daily")
    }

    async function setRefinementReport(){
        if (!await ensureAuth()) return
        document.getElementById('description').value = document.querySelector('div[jsname="NeC6gb"]').textContent.replace('Daily', 'Refinamiento')
        await setProjectAndTask("Temas internos", "Refinement")
    }

    async function setStaticUrlReport(element){
        if (!await ensureAuth()) return
        document.getElementById('description').value = element.description
        await setProjectAndTask(element.project, element.task)
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
            const static_urls = GM_getValue('url_static',[])
            setTimeout(()=>{
                document.querySelector('button[jsname="CQylAd"]').addEventListener('click', ()=> {
                    sendTimeTrackingData()
                    window.addEventListener('beforeunload', (e)=>{
                        e.preventDefault();
                        e.returnValue = '';
                    })
                })
                document.querySelector('div[jsname="ys7RQc"]').parentElement.appendChild(createImputationConfig());
                let element = static_urls.find(item => item.value === location.origin + location.pathname);
                if (location.origin + location.pathname === GM_getValue('daily_meet')){
                    setDailyReport();
                } else if (element){
                    setStaticUrlReport(element);
                };
            }, 3000)
        } catch(e){
            console.log(`Error ${e}`)
        }
    }

    async function configSettings(){
        GM_setValue('odoo_url', document.getElementById("odoo_url").value);
        GM_setValue('db', document.getElementById("db").value);
        GM_setValue('daily_meet', document.getElementById("daily").value);
        let static_urls = document.querySelectorAll('.new-url')
        static_urls.forEach((element)=>{
            const absolutes = GM_getValue('url_static')
            const elemento = absolutes.find(item => item.name === element.id)
            if (elemento){
                elemento.value = element.value
            }
            GM_setValue('url_static', absolutes)
        })
        const display_button = document.getElementById("display_imputation_buttom");
        odooRPC = new OdooRPC(
            GM_getValue("odoo_url"),
            GM_getValue("db"),
            {
                lang: "es_ES",
                tz: "Europe/Madrid",
            }
        )
        clickButton(saveButton, 'Configuración guardada','btn-primary','btn-success')
        const session = await ensureAuth()
        if (await session) await display_button.classList.remove('btn-warning')
        else await display_button.classList.add('btn-warning')
        setTimeout(()=>{
            clickButton(saveButton, 'Guardar configuración','btn-success','btn-primary', false)
        },1000)
    }

    async function getProyectOrTask(){
        if (!await ensureAuth()){
            this.value = ''
            return;
        }
        try{
            if (this.id === "project"){
                document.getElementById('task').disabled = true;
                cleanInfo([
                    document.getElementById('task'),
                    document.getElementById('task-id')
                ])
            }
            if (!this.value){
                console.log(`${this.id} no encontrado`);
                cleanInfo([
                    document.getElementById(`${this.id}`),
                    document.getElementById(`${this.id}-id`),
                    document.getElementById("description")
                ])
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
        }catch{
            showStatus(`${this.id} no encontrado`, "error", statusDiv)
            setTimeout(()=>{
                showStatus(``, undefined, statusDiv)
            },2000)
        }
    }

    async function stopAndStartNewImputation(){
        let susscess = await sendTimeTrackingData()
        setTimeout(()=>{
            clickButton(imputationButton,text_button,(susscess)?'btn-success':'btn-danger','btn-primary', false)
        }, 1000)
        if (!susscess) return
        cleanInfo([
            document.getElementById('description'),
            document.getElementById('task-id'),
            document.getElementById('task'),
            document.getElementById('project-id'),
            document.getElementById('project'),
        ])
        initialTime = new Date();
        console.log(`Nuevo Temporizador iniciado a las: ${initialTime.toLocaleTimeString()}`);
        let text_button = "Imputar"
        if (location.origin + location.pathname === GM_getValue('daily_meet')){
            setRefinementReport();
            text_button = "Imputar y empezar otra tarea"
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

    async function sendTimeTrackingData() {
        if (!await ensureAuth()) return
        project_id = parseInt(document.getElementById('project-id').textContent)
        task_id = parseInt(document.getElementById('task-id').textContent)
        description = document.getElementById('description').value;
        if (!project_id){
            showStatus("Proyecto incorrecto", "error", statusDiv)
            clickButton(imputationButton,'Error al imputar','btn-primary','btn-danger')
            setTimeout(()=>{
                showStatus("", undefined, statusDiv)
                clickButton(imputationButton,'Imputar','btn-danger','btn-primary',false)
            }, 2000)
            return false;
        }
        if (!task_id){
            showStatus("Tarea incorrecta", "error", statusDiv)
            clickButton(imputationButton,'Error al imputar','btn-primary','btn-danger')
            setTimeout(()=>{
                showStatus("", undefined, statusDiv)
                clickButton(imputationButton,'Imputar','btn-danger','btn-primary',false)
            }, 2000)
            return false;
        }
        if (!description){
            showStatus("La descripción es obligatoria", "error", statusDiv)
            clickButton(imputationButton,'Error al imputar','btn-primary','btn-danger')
            setTimeout(()=>{
                showStatus("", undefined, statusDiv)
                clickButton(imputationButton,'Imputar','btn-danger','btn-primary',false)
            }, 2000)
            return false;
        }
        const endTime = new Date();
        const elapsedMilliseconds = endTime - initialTime;
        let elapsedHours = Math.round((elapsedMilliseconds / 3600000)*100)/100;
        elapsedHours = checkEndNumber(elapsedHours);
        console.log(`Tiempo total a imputar: ${formatDecimalToTime(elapsedHours)}.`);
        try {
            clickButton(imputationButton,'Creando imputación ...','btn-primary','btn-info')
            await odooRPC.createTimesheetEntry(
                project_id,
                task_id,
                description,
                elapsedHours
            )
            clickButton(imputationButton,'Imputación creada','btn-info','btn-success')
            return true
        } catch {
            clickButton(imputationButton,'Error al imputar','btn-primary','btn-danger')
            return false
        }
    }

    function createInputBlock(id, labelText, inputValue, inputClass, blockClass) {
        const block = document.createElement("div");
        block.id = `block-${id}`;
        block.classList = blockClass;

        const label = document.createElement("label");
        label.setAttribute("for", id);
        label.textContent = labelText;
        label.classList = "input-group-text";
        label.style = "margin-top: 5px; justify-content: center; display:flex; align-items: center";
        block.appendChild(label);

        const input = document.createElement('input');
        input.id = id;
        input.classList = inputClass;
        input.value = inputValue || '';
        input.addEventListener('blur', ()=>{
            input.value = input.value.trim()
        });
        block.appendChild(input);

        if (inputClass.endsWith('new-url')){
            const span_conf = document.createElement('span');
            span_conf.classList = "input-group-text";
            span_conf.style = "margin-top: 5px;background: grey;"
            span_conf.innerText = '⚙️'
            span_conf.style.cursor = 'pointer'
            span_conf.addEventListener('click', async ()=>{
                if (!await newStaticUrl()){
                    showStatus(`La url estatica ${id} no ha podido guardarse`, "error", statusDiv)
                }else {
                    showStatus(`La url estatica ${id} guardada con exito`, "success", statusDiv)
                    let absolutes = GM_getValue("url_static",[]);
                    let element = absolutes.find(item => item.name === id);
                    absolutes.pop(element);
                    GM_setValue("url_static",absolutes);
                }
                setTimeout(()=>{
                    showStatus(``, undefined, statusDiv)
                },2000)
            })
            const span_del = document.createElement('span');
            span_del.classList = "input-group-text";
            span_del.style = "margin-top: 5px;background: #e35f5d;"
            span_del.innerText = '❌'
            span_del.style.cursor = 'pointer'
            span_del.addEventListener('click', async ()=>{
                showStatus(`La url estatica ${id} borrada con exito`, "success", statusDiv)
                let absolutes = GM_getValue("url_static",[]);
                let element = absolutes.find(item => item.name === id);
                absolutes.pop(element);
                GM_setValue("url_static",absolutes)
                block.remove()
                setTimeout(()=>{
                    showStatus(``, undefined, statusDiv)
                },2000)
            })
            block.append(span_del,span_conf);
        }
        return block;
    };

    function cleanUrl(){
        let absolutes = GM_getValue("url_static",[]);
        let element = absolutes.find(item => item.name === id);
        absolutes.pop(element);
        GM_getValue("url_static",absolutes)
    }

    function createImputationConfig() {
        const imputationConfig = document.createElement("div");
        imputationConfig.id = "imputation_config";
        imputationConfig.classList = "pt8HRc RTBkae";
        imputationConfig.style.top = "0px";
        imputationConfig.style.right = "0px";

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

        const urlConfig = document.createElement("div");
        urlConfig.id = "url_config";
        urlConfig.classList = "form-section";
        urlConfig.style.maxHeight = "200px";
        urlConfig.style.overflow = "overlay";

        const taskConfig = document.createElement("div");
        taskConfig.id = "task_config";
        taskConfig.classList = "form-section active";

        const configTab = document.createElement("div");
        configTab.classList = "tab";
        configTab.id = "config-tab";
        configTab.innerText = "Configuración";

        const urlTab = document.createElement("div");
        urlTab.classList = "tab";
        urlTab.id = "url-tab";
        urlTab.innerText = "URLs estáticas";

        const projectTaskTab = document.createElement("div");
        projectTaskTab.classList = "tab active";
        projectTaskTab.id = "project-task-tab-tab";
        projectTaskTab.innerText = "Imputación personalizada";

        const buttonConfig = document.createElement("div");
        buttonConfig.id = "button_config";
        buttonConfig.classList = "block-config"

        imputationButton = document.createElement("button");
        imputationButton.id = 'save-imputation'
        if (GM_getValue("daily_meet") === location.origin + location.pathname){
            imputationButton.textContent = "Imputar y empezar Refinamiento";
            imputationButton.addEventListener("click", stopAndStartNewImputation)
        } else {
            imputationButton.textContent = "Imputar";
            imputationButton.addEventListener("click", stopAndStartNewImputation)
        }
        imputationButton.classList = "btn btn-primary";

        saveButton = document.createElement("button");
        saveButton.id = 'save-config';
        saveButton.textContent = "Guardar configuración";
        saveButton.classList = "btn btn-primary";
        saveButton.style.display = 'none';

        statusDiv = document.createElement('div');
        statusDiv.id = "imputation-status";

        const div_footer = document.createElement('div');
        div_footer.id = "footer";
        const github = document.createElement('a');
        github.href = "https://github.com/FlJesusLorenzo/tamper-monkey-meet";
        github.target = "_blank";
        github.style.color = "black";
        const foot_img = document.createElement('img');
        foot_img.src = "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/GitHub_Invertocat_Logo.svg/1024px-GitHub_Invertocat_Logo.svg.png"
        foot_img.width = '20'
        const by_name = document.createElement('span')
        by_name.innerText = 'by Jesús Lorenzo'

        const add_static_url = document.createElement('button')
        add_static_url.id = 'add-url';
        add_static_url.textContent = "Agregar nueva URL";
        add_static_url.classList = "btn btn-primary";
        urlConfig.appendChild(add_static_url)

        globalConfig.appendChild(createInputBlock("odoo_url", "URL Odoo: ", GM_getValue("odoo_url"), "global-config form-control", "input-group flex-nowrap mb-3"));
        globalConfig.appendChild(createInputBlock("db", "Base de datos: ", GM_getValue("db"), "global-config form-control", "input-group flex-nowrap mb-3"));
        globalConfig.appendChild(createInputBlock("daily", "URL meet daily: ", GM_getValue("daily_meet"), "global-config form-control", "input-group flex-nowrap mb-3"));
        GM_getValue('url_static',[]).forEach((element)=>{
            urlConfig.appendChild(createInputBlock(element.name, `URL meet ${element.label}`, element.value, "global-config form-control new-url", "input-group flex-nowrap mb-3"));
        })

        function createTaskBlock(id, labelText, inputClass, blockClass) {
            const block = document.createElement("div");
            block.id = `block-${id}`;
            block.classList = blockClass

            const label = document.createElement("label");
            label.setAttribute("for", id);
            label.textContent = labelText;
            label.classList = "input-group-text"
            label.style = "margin-top: 5px; justify-content: center; display:flex; align-items: center";

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
            span_id.style.display = 'none'

            block.appendChild(label);
            block.appendChild(input);
            block.appendChild(span_id);

            if (id !== 'description') input.addEventListener("change", getProyectOrTask)

            return block;
        }

        taskConfig.appendChild(createTaskBlock("project","Proyecto: ","task-config form-control", "input-group flex-nowrap mb-3"));
        taskConfig.appendChild(createTaskBlock("task","Tarea: ","task-config form-control", "input-group flex-nowrap mb-3"));
        taskConfig.appendChild(createTaskBlock("description","Descripción: ", "task-config form-control", "input-group flex-nowrap mb-3"))

        github.append(foot_img,by_name)
        div_footer.append(github)
        buttonConfig.append(imputationButton, saveButton);
        formTabs.append(projectTaskTab, configTab, urlTab)
        imputationInputs.append(formTabs, globalConfig, taskConfig, urlConfig);
        div_container.append(title, imputationInputs, statusDiv, buttonConfig, div_footer);
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
            if (document.getElementById('project-id').textContent === ''){
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
        add_static_url.addEventListener('click', async ()=>{
                    await newStaticUrl()
                    setTimeout(()=>{
                        showStatus(``, undefined, statusDiv)
                    },2000)
                })

        if (!GM_getValue('odoo_url') || GM_getValue("odoo_url") === '') {
            switchTab(configTab, projectTaskTab, globalConfig, taskConfig);
            saveButton.style.display = '';
            display_buttom.style.backgroundColor = "#ffc107"
        }

        return imputationConfig;
    }

    function toCamelCase(text) {
        return text
            .toLowerCase()
            .split(' ')
            .map((word, index) =>
                 index === 0
                 ? word
                 : word.charAt(0).toUpperCase() + word.slice(1)
                )
            .join('');
    }

    async function newStaticUrl(){
        if (!await ensureAuth()) return false
        const name = prompt('Nombre');
        if (name === null) return false
        const url = prompt('URL');
        let project = null
        let task = null
        do{
            project = prompt('Nombre del proyecto:');
            if (project === null) return false
            let response = await odooRPC.odooSearch(
                `project.project`,
                [['name','ilike',project]],
                1,
                ["name"]
            );
            if (await response.records.length > 1){
                alert('Más de un proyecto encontrado, especifique más');
                project = null;
                continue;
            }else if (await response.records.length < 1){
                alert('Ningun proyecto encontrado, revise el nombre');
                project = null;
                continue;
            }
            project = await response.records[0].name
            if (!confirm(`Proyecto ${project} encontrado`)) project = null
        }while(!project);
        
        do{
            task = prompt('Tarea (solo tareas abiertas):');
            if (task === null) return false
            let response = await odooRPC.odooSearch(
                `project.task`,
                [
                    ['project_id.name','=',project],
                    ['name','ilike',task],
                    ['stage_id.closed','=',false]
                ],
                1,
                ["name"]
            );
            if (await response.records.length > 1){
                alert('Más de una tarea encontrada, especifique más')
                task = null
                continue;
            }else if (await response.records.length < 1){
                alert('Ninguna tarea encontrada, revise el nombre o si la tarea está cerrada')
                task = null
                continue;
            }
            task = await response.records[0].name
            if (!confirm(`Tarea ${task} encontrada`)) task = null 
        }while(!task);
        
        const description = prompt("Descripción por defecto:")
        let values = {
            name: toCamelCase(name),
            label: name,
            value: url,
            task: task,
            project: project,
            description: description
        }
        let statics = GM_getValue("url_static", [])
        let element = statics.find(item => item.value === url)
        if (element && document.getElementById(element.name)) document.getElementById(`block-${element.name}`).remove()
        statics.push(values)
        GM_setValue('url_static', statics)
        document.getElementById('url_config').appendChild(createInputBlock(values.name, `URL meet ${values.label}`, values.value, "global-config form-control new-url", "input-group flex-nowrap mb-3"))
        return true
    }

    window.addEventListener('load', () => {
        const button = document.querySelector('.XCoPyb');
        if (button)button.addEventListener('click', startTime);
        else startTime();
    });

})();
