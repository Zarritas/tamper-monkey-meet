// ==UserScript==
// @name         Google Meet Imputación automática
// @namespace    http://tampermonkey.net/
// @version      2025-10-30
// @description  Registra el tiempo en un Google Meet y lo envía a una API con un botón.
// @author       TuNombre
// @match        https://meet.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @resource overlay https://raw.githubusercontent.com/FlJesusLorenzo/tamper-monkey-meet/refs/heads/main/main/html/overlay.html
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
  GM_setValue("daily_meet", "https://meet.google.com/ysi-xgns-isx")
  GM_setValue("odoo_url", prompt("url de odoo"))
  GM_setValue("db", prompt("base de datos"))
  
  async function setDailyReport(){
    description = document.querySelector('div[jsname="r4nke"]').textContent.split(' ').slice(0,2).join(' ')
    await setProjectAndTask("Temas internos", "Daily")
  }
  async function setRefinementReport(){
    description = document.querySelector('div[jsname="r4nke"]').textContent.split(' ').slice(0,2).join(' ').replace('Daily', 'Refinamiento')
    await setProjectAndTask("Temas internos", "Refinement")
  }
  function setTaskReport(){
    console.error("Not Implemented")
    // 
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
      } catch(e){
          console.log(`Error ${e}`)
      }
      setTimeout(()=>{
          document.querySelector('button[jsname="CQylAd"]').addEventListener('click', sendTimeTrackingData)
      }, 5000)
  }

  function stopAndStartNewImputation(){
    sendTimeTrackingData();
    initialTime = new Date();
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

  window.addEventListener('load', () => {
      odooRPC = new OdooRPC(
        GM_getValue("odoo_url"),
        GM_getValue("db"),
        {
            lang: "es_ES",
            tz: "Europe/Madrid",
      })
      const menu = document.createElement("div")
      menu.innerHTML = GM_getResourceText('overlay')
      
      document.body.append(button)

      const create_imputation = document.getElementById('create_imputation')
      create_imputation.addEventListener("click", sendTimeTrackingData)
    });
      try{
          odooRPC.authenticate()
      }catch (e){
          console.log(`Error ${e}`)
      }
      document.querySelector('.XCoPyb').addEventListener('click', startTime)
  });
})();
