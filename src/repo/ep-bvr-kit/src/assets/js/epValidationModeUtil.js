// Copyright (c) 2020 Siemens
/**
 * @module js/epValidationModeUtil
 */
 import appCtxSvc from 'js/appCtxService';

 const EP_VALIDATION_MODE = 'epPageContext.showValidationPanel';
 
 /**
  * toggle Validation Mode
  */
 export function toggleValidationMode() {
     let isValidationDisplayed = appCtxSvc.getCtx( EP_VALIDATION_MODE ) ? appCtxSvc.getCtx( EP_VALIDATION_MODE ) : false;
     appCtxSvc.updatePartialCtx( EP_VALIDATION_MODE, !isValidationDisplayed );
 }
 
 const exports = {
     toggleValidationMode
 };
 
 export default exports;
 