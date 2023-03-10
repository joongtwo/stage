// Copyright (c) 2022 Siemens

/**
 * JS Service defined to handle Show My Dashboard related method execution only.
 *
 * @module js/showLandingPageChartService
 */
import appCtxService from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';
import landingPgSrvcUtil from 'js/landingPageServiceUtil';
import modelPropertySvc from 'js/modelPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import logger from 'js/logger';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';

var exports = {};
var _reportsList = null;
var _pageSize = 8;

/**
 * @private
 *
 * @property {promise} Cached reference.
 */
var URL_PARAMETER_PREFIX = 'UrlParameter_';

/**
 * @private
 *
 * @property {promise} Cached reference.
 */
var XRT_PAGE_ID = 'ActiveXrtPageId';

/**
 * Any ongoing visibility load call
 */
var activeSoaLoad = null;

export let getReportDefinitionValList = function( response ) {
    _reportsList = response.reportdefinitions.map( function( rDef ) {
        return response.ServiceData.modelObjects[ rDef.reportdefinition.uid ];
    } );
    appCtxService.updatePartialCtx( 'search.totalFound', _reportsList.length );
    return {
        reportdefinitions: _reportsList
    };
};

//################# MY DASHBOARD TILE VIEW METHODS ####################
/**
 *  fsd
 * @param {*} startIndex -
 * @returns {*} cursorObject
 */
var getCursorObject = function( startIndex ) {
    var totalFound = _reportsList.length;
    var mEndIndex = null;
    var mEndReached = null;

    if( startIndex === 0 ) {
        if( totalFound >= _pageSize ) {
            mEndIndex = _pageSize;
            mEndReached = false;
        } else {
            mEndIndex = totalFound;
            mEndReached = true;
        }
    } else {
        if( _pageSize + startIndex > totalFound ) {
            mEndIndex = totalFound;
            mEndReached = true;
        } else {
            mEndIndex = _pageSize + startIndex;
            mEndReached = false;
        }
    }
    return {
        endIndex: mEndIndex,
        endReached: mEndReached,
        startIndex: startIndex,
        startReached: true
    };
};

var addSearchRecipeProps = function( reportDef, recipe ) {
    var props = [ 'reportChartObjects', 'translatedBaseCriteria', 'translatedFilterQueries' ];

    props.forEach( propName => {
        //set search receipe as a property value..
        var propAttrHolder = {
            displayName: propName,
            type: 'STRING',
            dbValue: recipe[ propName ]
        };
        var property = modelPropertySvc.createViewModelProperty( propAttrHolder );
        reportDef.props[ propName ] = property;
    } );

    return reportDef;
};

var getReportDefinitions = function( response ) {
    var index = 0;
    _reportsList = response.reportSearchRecipeObjects.map( function( receipe ) {
        var reportDef = response.ServiceData.modelObjects[ receipe.reportObject.uid ];
        var propAttrHolder = {
            displayName: 'tileIndex',
            type: 'STRING',
            dbValue: index.toString()
        };
        var property = modelPropertySvc.createViewModelProperty( propAttrHolder );
        reportDef.props.tileIndex = property;
        index++;
        return addSearchRecipeProps( reportDef, receipe );
    } );
    appCtxService.updatePartialCtx( 'search.totalFound', _reportsList.length );
    return {
        reportdefinitions: _reportsList
    };
};

var getReportDefinitionSOAInput = function( reportIdInput = 'reportDefinitionId', report ) {
    var repIdList = [];

    if ( report === 'All' ) {
        repIdList.push( 'MyTasks' );
        repIdList.push( 'TeamTasks' );

        if ( appCtxService.getCtx( 'visibleServerCommands.Smp0HasReadAccessForSchMgmtCmd' ) ) {
            repIdList.push( 'MyScheduleTasks' );
        } else {
            repIdList.push( 'TeamData' );
        }
    } else if ( report === 'Recent' ) {
        repIdList.push( 'Smp0_ADV_RECENT_RPT_01' );
    }

    var soaInput = [];
    if( repIdList.length > 0 ) {
        repIdList.forEach( idVal => {
            var inputStr = {};
            inputStr[ reportIdInput ] = idVal;
            if( reportIdInput === 'reportID' ) {
                inputStr.reportUID = '';
                inputStr.reportSource = '';
            }
            soaInput.push( inputStr );
        } );
    } else {
        var inputStr = {};
        inputStr[ reportIdInput ] = 'RANDOME###$$$$';
        soaInput.push( inputStr );
    }
    landingPgSrvcUtil.setupReportPersistCtx();
    return soaInput;
};

/**
 *
 * @param {*} data -
 */
var updateDashboardLastRefreshTime = function( data ) {
    var currentdate = new Date();
    var datetime = ' ' + currentdate.getDate() + '/' +
        ( currentdate.getMonth() + 1 ) + '/' +
        currentdate.getFullYear() + ' @ ' +
        currentdate.getHours() + ':' +
        currentdate.getMinutes() + ':' +
        currentdate.getSeconds();
    data.dashboardLastRefresh.displayValues = [ datetime ];
    data.dashboardLastRefresh.uiValue = datetime;
    data.dashboardLastRefresh.dbValue = datetime;
};

/**
 * Main entry point for Rendering Report Tiles.
 * Performs the SOA call to get required ReportDefinition BO's.
 * For Sub-sequent scroll, next set of RD are returned.
 * @param {*} data - data
 * @param {*} startIndex - Scroll index value
 * @param {*} report - All reports or recent report
 * @returns {*} List of ReportDefinition and cursor object.
 */
export let getReportDefinitionsForTileView = async function( data, startIndex, report ) {
    //Get dashboard update time..
    updateDashboardLastRefreshTime( data );
    if( appCtxService.ctx.preferences.REPORT_AW_MyDashboard_PageSize ) {
        _pageSize = parseInt( appCtxService.ctx.preferences.REPORT_AW_MyDashboard_PageSize[ 0 ] );
    }

    //If we need reports for my tasks, team tasks, schedule tasks or team data,
    //first check server command visibility
    if ( report === 'All' ) {
        var commandIds = [ 'Smp0HasReadAccessForSchMgmtCmd' ];
        await getVisibleCommands( commandIds );
    }
    //Tile config ReportDefinition processing
    if( startIndex === 0 ) {
        //get SOA input
        var soaInput = getReportDefinitionSOAInput( 'reportID', report );
        return soaService.postUnchecked( 'Internal-Search-2020-12-SearchFolder', 'getTranslatedReportSearchRecipe', {
            reportDefinitionCriteria: soaInput
        } ).then(
            function( response ) {
                var repDefList = getReportDefinitions( response );
                var finalRepList = repDefList.reportdefinitions.slice( 0, _pageSize );
                appCtxService.updatePartialCtx( 'ReportsContext.SearchParameters', response.commonSearchParameters );
                return {
                    reportdefinitions: finalRepList,
                    cursor: getCursorObject( startIndex )
                };
            } );
    } else if( startIndex > 0 ) {
        var tempRepList = _reportsList.slice( startIndex, startIndex + _pageSize );
        return {
            reportdefinitions: tempRepList,
            cursor: getCursorObject( startIndex )
        };
    }
};

/**
 * Call the SOA to load visibility for a list of commands
 *
 * @param {List<String>} commandIds Command ids to include
 * @returns {Promise} Promise resolved when done
 */
export let getVisibleCommands = function( commandIds ) {
    var input = getVisibleCommandsSoaInput( commandIds );

    activeSoaLoad = soaService.postUnchecked( 'Internal-AWS2-2016-03-UiConfig', 'getVisibleCommands', input, {} )
        .then( function( response ) {
            activeSoaLoad = null;
            // Report any partial errors to console and process the remaining commands information present in response
            if( response.ServiceData && response.ServiceData.partialErrors ) {
                var err = soaService.createError( response.ServiceData );
                logger.error( err.stack );
            }
            //"Fill out" the info and ensure non visibile commands have property set to false
            var visibleCommandsInfo = response.visibleCommandsInfo
                .reduce( function( acc, nxt ) {
                    acc[ nxt.commandId ] = true;
                    return acc;
                }, {} );
            commandIds.forEach( function( id ) {
                visibleCommandsInfo[ id ] = visibleCommandsInfo[ id ] || false;
            } );
            //Merge context here to handle lazy load case
            //In full reload case promise result will be used to fully replace context
            var currentCtx = appCtxService.getCtx( 'visibleServerCommands' ) || {};
            _.assign( currentCtx, visibleCommandsInfo );
            appCtxService.registerCtx( 'visibleServerCommands', currentCtx );
            updateSoaVisibilityContext( true, input, currentCtx );
            return visibleCommandsInfo;
        }, function( error ) {
            activeSoaLoad = null;
            updateSoaVisibilityContext( true );
            if( error ) {
                if( error.cause && error.cause.status === -1 ) {
                    // Show custom error message
                    localeService.getTextPromise().then( function( localTextBundle ) {
                        messagingService.showError( localTextBundle.SERVER_ERROR );
                    } );
                } else if( error.message ) {
                    messagingService.showError( error.message );
                } else {
                    messagingService.showError( JSON.stringify( error ) );
                }
            }
            return error;
        } );
    return activeSoaLoad;
};

/**
 * Update the server visibility context and fire an event to say it is updated
 *
 * @param {Boolean} soaCallFinished - if soa call finished
 * @param {Object} input - input
 * @param {Object} visibleCommandsInfo - Visible Commands Info
 */
var updateSoaVisibilityContext = function( soaCallFinished, input, visibleCommandsInfo ) {
    //Most likely not necessary, previously used to prevent aw-command click before server visibility completion
    //Stuck with this as API as app team services are checking also
    appCtxService.registerCtx( 'serverCommandVisibility', {
        soaCallFinished: soaCallFinished
    } );
    //Should not be necessary but stuck with this as API as app team services depend on this event
    eventBus.publish( 'soa.getVisibleCommands', {
        soaCallFinished: soaCallFinished,
        soaInput: input,
        visibleCommandsInfo: visibleCommandsInfo
    } );
};

/**
 * Get the SOA input
 *
 * @param {List<String>} commandIds Specific IDs to include in the call instead of all commands

 * @return {Object[]} Array of filtered Objects.
 */
export let getVisibleCommandsSoaInput = function( commandIds ) {
    return {
        getVisibleCommandsInfo: [ {
            clientScopeURI: appCtxService.getCtx( 'sublocation.clientScopeURI' ) || '',
            selectionInfo: getSelectionInfo(),
            commandContextInfo: getCommandContext(),
            commandInfo: getCommandInfo( commandIds )
        } ]
    };
};

/**
 * Get the selection information for SOA input
 *
 * @return {Object[]} Array of filtered Objects.
 */
export let getSelectionInfo = function() {
    var selInfo = [];
    var newStuffFolderUID = appCtxService.ctx.user.props.newstuff_folder.dbValue;
    var newStuffMO = cdm.getObject( newStuffFolderUID );
    selInfo.push( {
        contextName: '',
        parentSelectionIndex: -1,
        selectedObjects: [ toSoaModelObject( newStuffMO ) ]
    } );
    return selInfo;
};

/**
 * Get the model object info that will actually be sent to the server.
 * <P>
 * Note: We do not want to send any of the properties, just the UID since the next code will do a deep
 * compare on the set of objects to see if anything changed sine the last time it asked for command
 * visibility.
 *
 * @param {ModelObject} mo Model object
 * @return {Object} Model object data that is sent to server
 */
export let toSoaModelObject = function( mo ) {
    return {
        //Would remove type but the defaulting in soa service actually modifies input
        //which means next comparison would trigger another SOA call
        type: 'unknownType',
        uid: mo.uid
    };
};

/**
 * Get the selection information for SOA input
 *
 * @return {Object[]} Array of filtered Objects.
 */
export let getCommandContext = function() {
    var hostingInfo = [ {
        contextName: 'IsHosted',
        contextValue: appCtxService.ctx.aw_hosting_enabled ? 'true' : 'false'
    }, {
        contextName: 'HostType',
        contextValue: appCtxService.ctx.aw_host_type || ''
    } ];

    //uid is always included since many teams have used to avoid writing conditions against what is selected vs the opened object
    var urlInfo = ( appCtxService.getCtx( 'commandContextParameters' ) || [] ).concat( [ 'uid' ] ).map( function( param ) {
        if( _.includes( param, XRT_PAGE_ID ) ) {
            return {
                contextName: XRT_PAGE_ID,
                contextValue: _.replace( param, XRT_PAGE_ID + ':', '' )
            };
        }
        return {
            contextName: URL_PARAMETER_PREFIX + param,
            contextValue: appCtxService.getCtx( 'state.processed.' + param ) || ''
        };
    } );

    return hostingInfo.concat( urlInfo );
};

/**
 * Get the command information for SOA input
 *
 * @param {List<String>} commandIds Specific IDs to include in the call instead of all commands
 * @return {Object[]} Command info
 */
export let getCommandInfo = function( commandIds ) {
    return _.uniq( commandIds ).sort().map( function( commandId ) {
        return {
            commandCollectionId: '',
            commandId: commandId
        };
    } );
};

//################# MY DASHBOARD TILE VIEW METHODS END #################

export default exports = {
    getReportDefinitionValList,
    getReportDefinitionsForTileView,
    getVisibleCommands,
    getVisibleCommandsSoaInput,
    getSelectionInfo,
    getCommandContext,
    getCommandInfo,
    toSoaModelObject
};
