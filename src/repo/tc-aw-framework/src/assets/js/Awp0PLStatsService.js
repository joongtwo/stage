// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0PLStatsService
*/
import splmStatsService from 'js/splmStatsService';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import uwPropertyService from 'js/uwPropertyService';

var exports = {};
var performance = null;

export let enablePLStats = function( ) {
    if ( performance === null ) {
        performance = splmStatsService.initProfiler( true );
    } else {
        performance.enable();
    }
    appCtxService.updateCtx( 'plStatsEnabled', true );
    splmStatsService.enablePLStats();
    eventBus.publish( 'plStats.reset' );
    let elementList = document.getElementById( 'globalNavigationSideNav' ).getElementsByClassName( 'unpinned' );
    if( elementList.length !== 0 ) {
        eventBus.publish( 'awsidenav.pinUnpin' );
    }
};

export let disablePLStats = function() {
    performance.disable();
    splmStatsService.disablePLStats();
    appCtxService.updateCtx( 'plStatsEnabled', false );
};

export let updatePerformanceDisplayData = function( browserTypeDisp, ttiDisp, totalNetworkTimeDisp, totalSoaRequestsDisp, totalHttpRequestsDisp,
    domNodeCountDisp, domTreeDepthDisp, uniqueComponentsDisp, componentRendersDisp ) {
    let newPLStatsData = splmStatsService.getPLStatsData();
    let browserType = uwPropertyService.createViewModelProperty( 'browserType', browserTypeDisp, 'STRING', newPLStatsData.browserType, [ newPLStatsData.browserType ] );
    let tti = uwPropertyService.createViewModelProperty( 'tti', ttiDisp, 'STRING', newPLStatsData.tti, [ newPLStatsData.tti ] );
    let totalNetworkTime = uwPropertyService.createViewModelProperty( 'totalNetworkTime', totalNetworkTimeDisp, 'STRING', newPLStatsData.totalNetworkTime, [ newPLStatsData.totalNetworkTime ] );
    let totalSoaRequests = uwPropertyService.createViewModelProperty( 'totalSoaRequests', totalSoaRequestsDisp, 'STRING', newPLStatsData.soaCount, [ newPLStatsData.soaCount ] );
    let totalHttpRequests = uwPropertyService.createViewModelProperty( 'totalHttpRequests', totalHttpRequestsDisp, 'STRING', newPLStatsData.totalHttpRequests, [ newPLStatsData.totalHttpRequests ] );
    let domNodeCount = uwPropertyService.createViewModelProperty( 'domNodeCount', domNodeCountDisp, 'STRING', newPLStatsData.domNodeCount, [ newPLStatsData.domNodeCount ] );
    let domTreeDepth = uwPropertyService.createViewModelProperty( 'domTreeDepth', domTreeDepthDisp, 'STRING', newPLStatsData.domTreeDepth, [ newPLStatsData.domTreeDepth ] );
    let uniqueComponents = uwPropertyService.createViewModelProperty( 'uniqueComponents', uniqueComponentsDisp, 'STRING', newPLStatsData.uniqueComponents, [ newPLStatsData.uniqueComponents ] );
    let componentRenders = uwPropertyService.createViewModelProperty( 'componentRenders', componentRendersDisp, 'STRING', newPLStatsData.componentRenders, [ newPLStatsData.componentRenders ] );
    let plStatsData = {
        props: {
            browserType,
            tti,
            totalNetworkTime,
            totalSoaRequests,
            totalHttpRequests,
            domNodeCount,
            domTreeDepth,
            uniqueComponents,
            componentRenders
        }
    };
    for ( const [ _, value ] of Object.entries( plStatsData.props ) ) {
        uwPropertyService.setPropertyLabelDisplay( value, 'PROPERTY_LABEL_AT_TOP' );
    }
    return plStatsData;
};

export let resetPerformanceDisplayData = function( browserTypeDisp, ttiDisp, totalNetworkTimeDisp, totalSoaRequestsDisp, totalHttpRequestsDisp,
    domNodeCountDisp, domTreeDepthDisp, uniqueComponentsDisp, componentRendersDisp ) {
    let newPLStatsData = splmStatsService.getPLStatsData();
    let browserType = uwPropertyService.createViewModelProperty( 'browserType', browserTypeDisp, 'STRING', newPLStatsData.browserType, [ newPLStatsData.browserType ] );
    let tti = uwPropertyService.createViewModelProperty( 'tti', ttiDisp, 'STRING', '0.00 s', [ '0.00 s' ] );
    let totalNetworkTime = uwPropertyService.createViewModelProperty( 'totalNetworkTime', totalNetworkTimeDisp, 'STRING', '0.00 s', [ '0.00 s' ] );
    let totalSoaRequests = uwPropertyService.createViewModelProperty( 'totalSoaRequests', totalSoaRequestsDisp, 'STRING', '0', [ '0' ] );
    let totalHttpRequests = uwPropertyService.createViewModelProperty( 'totalHttpRequests', totalHttpRequestsDisp, 'STRING', '0', [ '0' ] );
    let domNodeCount = uwPropertyService.createViewModelProperty( 'domNodeCount', domNodeCountDisp, 'STRING', '0', [ '0' ] );
    let domTreeDepth = uwPropertyService.createViewModelProperty( 'domTreeDepth', domTreeDepthDisp, 'STRING', '0', [ '0' ] );
    let uniqueComponents = uwPropertyService.createViewModelProperty( 'uniqueComponents', uniqueComponentsDisp, 'STRING', '0', [ '0' ] );
    let componentRenders = uwPropertyService.createViewModelProperty( 'componentRenders', componentRendersDisp, 'STRING', '0', [ '0' ] );
    let plStatsData = {
        props: {
            browserType,
            tti,
            totalNetworkTime,
            totalSoaRequests,
            totalHttpRequests,
            domNodeCount,
            domTreeDepth,
            uniqueComponents,
            componentRenders
        }
    };
    for ( const [ _, value ] of Object.entries( plStatsData.props ) ) {
        uwPropertyService.setPropertyLabelDisplay( value, 'PROPERTY_LABEL_AT_TOP' );
    }
    return plStatsData;
};

export default exports = {
    enablePLStats,
    disablePLStats,
    updatePerformanceDisplayData,
    resetPerformanceDisplayData
};
