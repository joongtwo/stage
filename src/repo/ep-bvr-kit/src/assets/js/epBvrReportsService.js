//@<COPYRIGHT>@
//==================================================
//Copyright 2019.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * APIs for epBvrReportsService
 *
 * @module js/epBvrReportsService
 */
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import epSaveService from 'js/epSaveService';
import saveInputWriterService from 'js/saveInputWriterService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import { constants as epBvrConstants } from 'js/epBvrConstants';
import _ from 'lodash';
import fmsUtils from 'js/fmsUtils';
import mfeTypeUtils from 'js/utils/mfeTypeUtils';


const REPORT_PER_TYPE_PREFERENCE = 'MBC_REPORT_';
const ALL_REPORTS_PREFERENCE = 'Mbc0Report';
const REPORT_GENERATED = 'reportGenerated';
const EXCEL_REPORT = 'EXCEL';
const EXCEL_REPORT_FILE_NAME = 'Report.xlsm';
const PDF_REPORT_FILE_NAME = 'Report.pdf';

/**
 * This function generates the report.
 * @param {String} reportType selected report type
 * @returns {Object} returns promise
 */
export function generateReport( reportType ) {
    const reportTypeList = appCtxSvc.ctx.reportTypesList;
    let reportName;
    reportTypeList.forEach( ( type ) => {
        if( type.propInternalValue === reportType ) {
            reportName = type.propDisplayValue;
        }
    } );

    let saveInput = saveInputWriterService.get();
    const addReportInput = {
        reportName,
        reportType,
        id: appCtxSvc.ctx.ep.scopeObject.uid
    };
    saveInput.addReportInput( addReportInput );
    const relatedObjects = {
        [ appCtxSvc.ctx.ep.scopeObject.uid ]: {
            uid: appCtxSvc.ctx.ep.scopeObject.uid,
            type: appCtxSvc.ctx.ep.scopeObject.type
        }
    };
    return epSaveService.saveChanges( saveInput, false, relatedObjects ).then( function( responseObj ) {
        const saveEvents = responseObj.saveEvents;
        if( !_.isEmpty( saveEvents ) && !_.isEmpty( saveEvents[ 0 ].eventData ) && saveEvents[ 0 ].eventType === REPORT_GENERATED ) {
            const fileTicket = saveEvents[ 0 ].eventData[ 0 ];

            if( isExcelReport( reportType ) ) {
                fmsUtils.openFile( fileTicket.toString(), EXCEL_REPORT_FILE_NAME );
            } else {
                fmsUtils.openFile( fileTicket.toString(), PDF_REPORT_FILE_NAME );
            }

            eventBus.publish( 'reports.closePopup' );
        }
        saveInputWriterService.resetDataEntrySection( epSaveConstants.CREATE_REPORT );
    } );
}

/**
 * @param {String} reportId the id of the report
 * @returns {Object} data
 */
function isExcelReport( reportId ) {
    const allReports = appCtxSvc.ctx.preferences[ ALL_REPORTS_PREFERENCE ];
    let isExcel = false;
    if( allReports ) {
        for( let report of allReports ) {
            const reportValues = report.split( ':' );
            if( reportId === reportValues[ 0 ] && reportValues[ 1 ] === EXCEL_REPORT ) {
                isExcel = true;
            }
        }
    }
    return isExcel;
}

/**
 *
 * @param {*} inputParameters popup input params
 * @param {*} popupAction popup action
 */
export function showCreateReportPopup( inputParameters, popupAction ) {
    if( !popupAction ) {
        console.warn( 'null popupAction detected, double check your viewModel!' );
        return;
    }

    getReportTypeFromPreferences();
    popupAction.show( inputParameters );
}

/**
 * Get report types from preference
 */
export function getReportTypeFromPreferences() {
    const scopeObjectType = mfeTypeUtils.isOfType( appCtxSvc.ctx.ep.scopeObject, epBvrConstants.MFG_PROCESS_LINE ) === false ? appCtxSvc.ctx.ep.scopeObject.type : epBvrConstants.MFG_PROCESS_AREA;
    const typeOfReportsToShow = appCtxSvc.ctx.preferences[ REPORT_PER_TYPE_PREFERENCE + scopeObjectType ];
    let reportTypesList = [];
    if( typeOfReportsToShow ) {
        for( let i = 0; i < typeOfReportsToShow.length; i++ ) {
            const type = typeOfReportsToShow[ i ].split( ':' );
            reportTypesList.push( {
                propDisplayValue: type[ 1 ],
                propInternalValue: type[ 0 ]
            } );
        }
        //As the report type list needs to be present before the view is rendered hence using CTX for storing the report types.
        appCtxSvc.updateCtx( 'reportTypesList', reportTypesList );
    }
}

export default {
    generateReport,
    showCreateReportPopup,
    getReportTypeFromPreferences
};
