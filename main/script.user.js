// ==UserScript==
// @name         Google Meet Imputación automática
// @namespace    http://tampermonkey.net/
// @version      0.1.0
// @description  Registra el tiempo en un Google Meet y lo envía a una API con un botón.
// @author       TuNombre
// @match        https://meet.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @resource css https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/css/style.css
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-imputar/refs/heads/main/main/scripts/utils.js
// @require      https://raw.githubusercontent.com/FlJesusLorenzo/tampermonkey-odoo-rpc/refs/heads/main/OdooRPC.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

(function() {
    'use strict';
    let initialTime = null
    let odooRPC = null
    let task_id = null
    let description = null
    let project_id = null
    GM_addStyle(
        GM_getResourceText('css')
    )

    async function setDailyReport(){
        description = document.querySelector('div[jsname="r4nke"]').textContent.split(' ').slice(0,2).join(' ')
        await setProjectAndTask("Temas internos", "Daily")
    }
    async function setRefinementReport(){
        description = document.querySelector('div[jsname="r4nke"]').textContent.split(' ').slice(0,2).join(' ').replace('Daily', 'Refinamiento')
        await setProjectAndTask("Temas internos", "Refinement")
    }
    async function setTaskReport(){
        console.error("Not Implemented")
        // await setProjectAndTask(project_name, task_name)
    }

    async function setProjectAndTask(project_name, task_name){
        project_id = await odooRPC.odooSearch(
            'project.project',
            [['name','ilike', project_name]],
            1,
            ['id']
        );
        project_id = await project_id.records[0].id
        task_id = await odooRPC.odooSearch(
            'project.task',
            [
                ['project_id','=',project_id],
                ['stage_id.closed','=',false],
                ['name','ilike',task_name]
            ],
            1,
            ['id']
        );
        task_id = await task_id.records[0].id
    }

    async function startTime(){
        initialTime = new Date();
        console.log(`Temporizador iniciado a las: ${initialTime.toLocaleTimeString()}`);
        try{
            if (location.origin + location.pathname === GM_getValue('daily_meet')){
                setDailyReport();
            } else if (location.origin + location.pathname === GM_getValue('refinement_meet')){
                setRefinementReport();
            }else {
                setTaskReport();
            };
            setTimeout(()=>{
                document.querySelector('button[jsname="CQylAd"]').addEventListener('click', sendTimeTrackingData)
                createAndInjectOverlay()
            }, 5000)
        } catch(e){
            console.log(`Error ${e}`)
        }
    }

    function stopAndStartNewImputation(){
        sendTimeTrackingData();
        initialTime = new Date();
        setRefinementReport()
    }

    function sendTimeTrackingData() {
        const endTime = new Date();
        const elapsedMilliseconds = endTime - initialTime;
        const elapsedHours = Math.round(elapsedMilliseconds / 3600000);

        console.log(`Tiempo total a imputar: ${formatDecimalToTime(elapsedHours)}.`);

        odooRPC.createTimesheetEntry(
            project_id,
            task_id,
            description,
            elapsedHours
        )
    }

    // function createInput(id, type, class_list, label_text, value = ""){
    //     const div = document.createElement('div')
    //     const input = document.createElement('input')
    //     const label = document.createElement('label')
    //     div.id = `block-${id}`
    //     input.type = type
    //     input.classList = class_list
    //     input.value = value;
    //     label.id = `label-${id}`
    //     label.textContent = label_text;
    //     div.append(label,input)
    //     return div
    // }

    function createAndInjectOverlay(){
        const menu = document.createElement('div');
//         const button = document.createElement('button');
//         const inputs = document.createElement('div')
//         const url_input = createInput('url','text','','URL:',GM_getValue('odoo_url')||'');
//         const db_input = createInput('db','text','','Database:',GM_getValue('db')||'');
//         const daily_input = createInput('daily_meet','text','','URL Meet Daily:',GM_getValue('daily_meet')||'');
        const create_imputation = document.createElement('button');

        create_imputation.id = "create_imputation"
        menu.id = "imputation_conf"
        create_imputation.innerText = "Imputar Daily y empezar a contar refinamiento";
        menu.classList = 'dropdown'
        create_imputation.classList = "dropbtn"

//         inputs.append(url_input,db_input,daily_input)
        menu.append(create_imputation)
        document.body.append(menu)
        create_imputation.addEventListener("click", stopAndStartNewImputation)
    }
    
    function configSettings(){
        GM_setValue('odoo_url', prompt('URL Odoo'))
        GM_setValue('db', prompt('Base de datos'))
        GM_setValue('daily_meet', prompt('URL meet daily'))
    }

    window.addEventListener('load', () => {
        if (!GM_getValue('odoo_url') || !GM_getValue('daily_meet')){
            configSettings()
        }
        odooRPC = new OdooRPC(
            GM_getValue("odoo_url"),
            GM_getValue("db"),
            {
                lang: "es_ES",
                tz: "Europe/Madrid",
            }
        )
        try{
            odooRPC.authenticate()
        }catch (e){
            console.log(`Error ${e}`)
        }
        document.querySelector('.XCoPyb').addEventListener('click', startTime)
    });
})();
