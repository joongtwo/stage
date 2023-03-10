// Copyright (c) 2022 Siemens

/**
 * This service implements commonly used functions by Reports module.
 *
 * @module js/landingPageServiceUtil
 */
import appCtxService from 'js/appCtxService';

//################# ALL STRING CONSTANTS ###################
// var m_reportPersistCtx = 'ReportsPersistCtx';
var m_dashboardCtxList = 'ReportsPersistCtx.MyDashboardReportList';
var m_reportDashboardPrefName = 'REPORT_AW_MyDashboard_TC_Report';
var m_ctxPrefName = 'preferences.' + m_reportDashboardPrefName;
var m_awSourceName = 'Active Workspace';
var m_repCtxSearchInfo = 'ReportsContext.reportParameters.ReportDefProps.ReportSearchInfo';
var m_reportChart1 = 'ReportChart1';
var m_reportChart2 = 'ReportChart2';
var m_reportChart3 = 'ReportChart3';

export let getReportDashboardPrefName = function() {
    return m_reportDashboardPrefName;
};

export let getAWReportSourceName = function() {
    return m_awSourceName;
};

export let getCtxForReportsPreference = function() {
    return m_ctxPrefName;
};

export let getCtxMyDashboardList = function() {
    return m_dashboardCtxList;
};

export let getReportsCtxSearchInfo = function() {
    return m_repCtxSearchInfo;
};

export let getReportChart1 = function() {
    return m_reportChart1;
};

export let getReportChart2 = function() {
    return m_reportChart2;
};

export let getReportChart3 = function() {
    return m_reportChart3;
};

//###################### END ################################
var exports = {};

export let setupReportPersistCtx = function() {
    if( appCtxService.ctx.preferences.REPORT_AW_MyDashboard_TC_Report !== null && appCtxService.ctx.preferences.REPORT_AW_MyDashboard_TC_Report.length > 0 ) {
        var reports = appCtxService.ctx.preferences.REPORT_AW_MyDashboard_TC_Report;
        var rdIdList = [];
        reports.forEach( element => {
            if( element.length !== 0 ) {
                var val = JSON.parse( element.substring( element.indexOf( ':' ) + 1, element.length ) );
                rdIdList.push( val.ID );
            }
        } );
        appCtxService.updatePartialCtx( m_dashboardCtxList, rdIdList );
    } else if( appCtxService.ctx.preferences.REPORT_AW_MyDashboard_TC_Report === null ) {
        appCtxService.updatePartialCtx( m_dashboardCtxList, [] );
    }
};

export let getRelationTraversalType = function( segment, ctxParams ) {
    var refProp = '';
    if( segment && segment.props.fnd0RelationOrReference.selectedLovEntries.length > 0 && segment.props.fnd0RelationOrReference.selectedLovEntries[ 0 ].propDisplayDescription.endsWith(
        '(Reference)' ) ) {
        refProp = 'REF';
    } else if( segment && segment.props.fnd0RelationOrReference.selectedLovEntries.length > 0 && segment.props.fnd0RelationOrReference.selectedLovEntries[ 0 ].propDisplayDescription.endsWith(
        '(Relation)' ) && segment.props.fnd0Direction.dbValue ) {
        refProp = 'GRM';
    } else if( segment && segment.props.fnd0RelationOrReference.selectedLovEntries.length > 0 && segment.props.fnd0RelationOrReference.selectedLovEntries[ 0 ].propDisplayDescription.endsWith(
        '(Relation)' ) && !segment.props.fnd0Direction.dbValue ) {
        refProp = 'GRMS2P';
    } else if( ctxParams && ctxParams.ReportDefProps.ReportSegmentParams && ctxParams.ReportDefProps.ReportSegmentParams.length > 0 &&
        ctxParams.ReportDefProps.ReportSegmentParams.length > segment.index - 1 ) {
        refProp = ctxParams.ReportDefProps.ReportSegmentParams[ segment.index - 1 ].RelRefType;
    }
    return refProp;
};

export let getDiscussionsCount = function( data ) {
    if( data ) {
        appCtxService.updatePartialCtx( 'discussionsData', data );
    }
};

export default exports = {
    getReportDashboardPrefName,
    getAWReportSourceName,
    getCtxForReportsPreference,
    getCtxMyDashboardList,
    getReportsCtxSearchInfo,
    setupReportPersistCtx,
    getReportChart1,
    getReportChart2,
    getReportChart3,
    getRelationTraversalType,
    getDiscussionsCount
};
