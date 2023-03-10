// Copyright (c) 2022 Siemens

/**
 * Service for Alignment Check feature related APIs.
 * @module js/CadBomOccAlignmentCheckService
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import dataManagementService from 'soa/dataManagementService';
import cdmSvc from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import locationNavigationService from 'js/locationNavigation.service';
import soaService from 'soa/kernel/soaService';
import messagingService from 'js/messagingService';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import cbaOpenInViewPanelService from 'js/cbaOpenInViewPanelService';
import cbaConstants from 'js/cbaConstants';
import cbaFindAlignedService from 'js/cbaFindAlignedService';
import occmgmtUtils from 'js/occmgmtUtils';

let exports = {};

// Constants
export const CBA_SRC_CONTEXT = 'CBASrcContext';
export const CBA_TRG_CONTEXT = 'CBATrgContext';

const DISPLAY_OPTIONS_ALIGNED = 'ALIGNED';
const DISPLAY_OPTIONS_NOTALIGNED = 'NOTALIGNED';

const MATCH_TYPE_MISSING_SOURCE = 'MISSING_SOURCE';
const MATCH_TYPE_MISSING_TARGET = 'MISSING_TARGET';
const MATCH_TYPE_FULL_MATCH = 'FULL_MATCH';
const MATCH_TYPE_MULTIPLE_FULL_MATCH = 'MULTIPLE_FULL_MATCH';

const CURRENT_LEVEL = -1;
const ALL_LEVELS = -1;

const ACC_ALIGNMENT_CHECK_CRITERIA = 'ACC_ALIGNMENT_CHECK_CRITERIA';

const DIFFERENCES_VALID_VALUES = [ 1, 2, 3, 4, 5, 6, 101, 102, 357, 359, 614 ];

const CTX_PATH_IS_CBA_FIRST_LAUNCH = 'data.scope.subPanelContext.provider.cbaContext.isCBAFirstLaunch';
const CTX_PATH_IS_LEVEL_CHECK_DONE = 'cbaContext.alignmentCheckContext.isAllLevelCheckDone';

// Variables
let _eventSubDefs = [];
let _sourceVMOs = [];
let _targetVMOs = [];

/**
  * Execute Alignmwent Check on node expansion
  */
let _executeAlignmentCheckOnNodeExpansion = () => {
    let srcCompareInfo = _getExecutedAlignmentCheckInfo( CBA_SRC_CONTEXT );
    let trgCompareInfo = _getExecutedAlignmentCheckInfo( CBA_TRG_CONTEXT );
    if( srcCompareInfo && trgCompareInfo ) {
        let sourceVMOs = _getLoadedVMOjects( CBA_SRC_CONTEXT );
        let targetVMOs = _getLoadedVMOjects( CBA_TRG_CONTEXT );
        let alignmentCheckInfo = _getAlignmentCheckInfoObject( ALL_LEVELS, ALL_LEVELS, sourceVMOs, targetVMOs,
            false, false, null, null, srcCompareInfo.element, trgCompareInfo.element );
        _executeAlignmentCheck( alignmentCheckInfo );
    }
};

/**
  *Function to call when ACE visibility change event is fired
  *
  * @param {Object} data - Source or Target tree data
  */
let _visibilityChangeListener = function( data ) {
    if( _.has( data, [ 'scope' ] ) && data.scope.subPanelContext ) {
        if( data.scope.subPanelContext.provider.dataProviderName === 'trgOccDataProvider' ) {
            _targetVMOs = data.scope.data.dataProviders.trgOccDataProvider.viewModelCollection.loadedVMObjects;
        } else {
            _sourceVMOs = data.scope.data.dataProviders.srcOccDataProvider.viewModelCollection.loadedVMObjects;
        }
        let provider = data.scope.subPanelContext.provider;
        let isCBAFirstLaunch = provider.cbaContext.isCBAFirstLaunch;
        let newCbaContext = { ...data.scope.subPanelContext.provider.cbaContext.value };
        if( isCBAFirstLaunch ) {
            if( _sourceVMOs && _sourceVMOs.length > 0 && _targetVMOs && _targetVMOs.length > 0 ) {
                newCbaContext.isCBAFirstLaunch = false;
                provider.cbaContext.update( newCbaContext );
            } else if( provider.openedObject && !( data.scope.subPanelContext && provider.cbaContext.srcStructure && provider.cbaContext.trgStructure ) ) {
                let promise = cbaOpenInViewPanelService.initializeServiceForLinkedBom( provider );
                promise.then( function() {
                    let panelContext = cbaOpenInViewPanelService.getOpenPanelConextFromGrid( provider.gridId );
                    cbaOpenInViewPanelService.populateFilterTypesForOpenInViewPanel( panelContext.contextKey );
                    eventBus.publish( 'cba.executeCommandOpenPanel', panelContext );
                    newCbaContext.isCBAFirstLaunch = false;
                    provider.cbaContext.update( newCbaContext );
                } );
            }
        } else {
            // Expand Node case
            // If All level alignment check done then for expand node operation start fresh navigation should be false.
            if( data.isAlignmentChanged || _isExpansionCase( data.scope.subPanelContext ) ) {
                delete data.isAlignmentChanged;
                _executeAlignmentCheckOnNodeExpansion();
            }
        }
    }
};

/**
  * Function to call when ACE Add Element event is fired
  */
let _addElementListener = function() {
    exports.clearAlignmentCheckStatus();
    eventBus.publish( 'cba.changeEBOMToDefaultMode' );
};

/**
  * Get created object which represents Alignment Check Info object
  *
  * @param {number} srcDepth - Source depth
  * @param {number} trgDepth - Target depth
  * @param {Array} srcVMOs - Source VMOs
  * @param {Array} trgVMOs - Source VMOs
  * @param {boolean} starFreshCheck - true if need fresh alignment check else false
  * @param {boolean} runInBackground - true if need alignment check to be done in background else false
  * @param {Object} dataSetUID - dataSet Uid
  * @param {Object} panelData - Alignment Check Setting panel object
  * @param {Object} srcCtx - Source context object
  * @param {Object} trgCtx - Target context object
  *
  * @returns {object} Alignment Check info object
  */
let _getAlignmentCheckInfoObject = function( srcDepth, trgDepth, srcVMOs, trgVMOs, starFreshCheck, runInBackground, dataSetUID, panelData, srcCtx, trgCtx ) {
    return {
        sourceInfo: {
            depth: srcDepth,
            VMOs: srcVMOs,
            contextElement: srcCtx
        },
        targetInfo: {
            depth: trgDepth,
            VMOs: trgVMOs,
            contextElement: trgCtx
        },
        startFreshAlignmentCheck: starFreshCheck,
        runInBackground: runInBackground,
        panelData: panelData,
        dataSetUID: dataSetUID
    };
};

/**
  * Execute alignment check
  *
  * @param {Object} alignmentCheckInfo - Alignment Check Info object which contains source and target info.
  */
let _executeAlignmentCheck = function( alignmentCheckInfo ) {
    let alignmentCheckInput = _createAlignmentCheckInput( alignmentCheckInfo );
    _performAlignmentCheck( alignmentCheckInput );
};

/**
  * Get view model objects from context
  *
  * @param {String} contextKey - Source or Target Context key
  * @returns {object} List of view model objects
  */
let _getLoadedVMOjects = function( contextKey ) {
    let loadedVMObjects;
    if( appCtxSvc.ctx[ contextKey ] && appCtxSvc.ctx[ contextKey ].vmc ) {
        loadedVMObjects = appCtxSvc.ctx[ contextKey ].vmc.getLoadedViewModelObjects();
    }
    return loadedVMObjects;
};

/**
  * get element from context
  *
  * @param {String} context - CBA Source or Target context
  * @returns {object} - Element Object
  */
let _getElementFromContext = function( context ) {
    let element;
    let uid = appCtxSvc.getCtx( context + '.currentState.c_uid' );

    if( cdmSvc.isValidObjectUid( uid ) ) {
        element = cdmSvc.getObject( uid );

        if( !element ) {
            console.log( 'No element found for uid:' + uid + ', get element from context from previous alignment check.' );
            let alignmentCheckInfo = _getExecutedAlignmentCheckInfo( context );
            element = alignmentCheckInfo ? alignmentCheckInfo.element : null;
        }
    }
    return element;
};

/**
  * get Product Context from context
  *
  * @param {String} contextKey - CBA Source or Target context
  * @returns {object} - Product Context Object
  */
let _getProductContextFromContext = function( contextKey ) {
    return appCtxSvc.getCtx( contextKey + '.productContextInfo' );
};

/**
  *
  *
  * @param {String} contextKey Context name for source or target
  * @param {Array} vmoList List of ViewModelObjects loaded in structures
  * @param {number} depth Depth of structure to to comparision
  * @param {object} contextElement The context object
  * @returns {object} Compare info object
  */
let _getCompareInfo = function( contextKey, vmoList, depth, contextElement ) {
    let element = contextElement ? contextElement : _getElementFromContext( contextKey );
    let productContext = _getProductContextFromContext( contextKey );
    let visibleUids = _getUidsFromVMOs( vmoList );

    return {
        element: element,
        productContextInfo: productContext,
        visibleUids: visibleUids,
        depth: depth
    };
};

/**
  * Returns list of uids
  *
  * @param {Array} vmoList - List of ViewModelObject for which uids to return
  * @returns {Array} - List of uids
  */
let _getUidsFromVMOs = function( vmoList ) {
    let uids = [];
    if( vmoList ) {
        _.forEach( vmoList, function( value ) {
            uids.push( value.uid );
        } );
    }
    return uids;
};

/**
  * Get list of applicable match types based on selected display options
  *
  * @param {Object} displayOptions - Display Option object with Display option key and its ViewModelObject
  * @returns {Array} Array of applicable match types
  */
let _getMatchTypes = function( displayOptions ) {
    let matchTypes = [];
    for( let key in displayOptions ) {
        let vmo = displayOptions[ key ];
        if( vmo && vmo.dbValue ) {
            //TODO [Vikrant] - Restructure code
            if( DISPLAY_OPTIONS_ALIGNED === key ) {
                matchTypes.push( MATCH_TYPE_MULTIPLE_FULL_MATCH );
                matchTypes.push( MATCH_TYPE_FULL_MATCH );
            } else if( DISPLAY_OPTIONS_NOTALIGNED === key ) {
                matchTypes.push( MATCH_TYPE_MISSING_SOURCE );
                matchTypes.push( MATCH_TYPE_MISSING_TARGET );
            }
        }
    }
    return matchTypes;
};

/**
  * Get default alignment check configuration. If panelData is provided then default alignment
  * check configuration for Alignment Check Setting panel will returns, else default alignment
  * check configuration for Launch will be return.
  *
  * @param {Object} panelData - Alignment Check Setting panel view model
  * @returns {Object} Default alignment check configuration
  */
let _getDefaultAlignmentCheckConfiguration = function( panelData ) {
    return {
        displayLevel: CURRENT_LEVEL,
        backgroundOption: false,
        compareOptions: {
            Equivalence: [ ACC_ALIGNMENT_CHECK_CRITERIA ],
            CBA: [ 'true' ],
            MatchType: [ MATCH_TYPE_MULTIPLE_FULL_MATCH, MATCH_TYPE_FULL_MATCH, MATCH_TYPE_MISSING_SOURCE, MATCH_TYPE_MISSING_TARGET ]
        }
    };
};

/**
  * Get compare options for alignment check input
  *
  * @param {Object} alignmentCheckInfo The alignment check info object
  * @returns {Object} Compare Options object
  */
let _getCompareOptions = function( alignmentCheckInfo ) {
    let panelData = alignmentCheckInfo.panelData;
    let matchTypes;
    let defaultAlignmentCheckConfig = _getDefaultAlignmentCheckConfiguration( panelData );
    let compareOptions = defaultAlignmentCheckConfig.compareOptions;

    if( !alignmentCheckInfo.cbaPageLaunch &&
         appCtxSvc.ctx.cbaContext && appCtxSvc.ctx.cbaContext.alignmentCheckContext &&
         appCtxSvc.ctx.cbaContext.alignmentCheckContext.alignmentCheckSettingInfo ) {
        let displayOptions = appCtxSvc.ctx.cbaContext.alignmentCheckContext.alignmentCheckSettingInfo.displayOptions;
        matchTypes = _getMatchTypes( displayOptions );
    } else {
        matchTypes = defaultAlignmentCheckConfig.compareOptions.MatchType;
    }

    compareOptions.MatchType = matchTypes;
    return compareOptions;
};

/**
  * API to create alignment check input
  *
  * @param {Object} alignmentCheckInfo - Alignment Check Info object which contains source and target info.
  * @returns {Object} Alignment check input object
  */
let _createAlignmentCheckInput = function( alignmentCheckInfo ) {
    let sourceInfo = alignmentCheckInfo.sourceInfo;
    let targetInfo = alignmentCheckInfo.targetInfo;
    let sourceCompareInfo = _getCompareInfo( CBA_SRC_CONTEXT, sourceInfo.VMOs, sourceInfo.depth, sourceInfo.contextElement );
    let targetCompareInfo = _getCompareInfo( CBA_TRG_CONTEXT, targetInfo.VMOs, targetInfo.depth, targetInfo.contextElement );

    let sourceCursor = _getCBADefaultCursor();
    let targetCursor = _getCBADefaultCursor();

    let soaCompareOptionsList = _getCompareOptions( alignmentCheckInfo );

    let notificationMessage = {};
    if( alignmentCheckInfo.dataSetUID ) {
        notificationMessage = {
            uid: alignmentCheckInfo.dataSetUID
        };
    }

    return {
        inputData: {
            source: sourceCompareInfo,
            target: targetCompareInfo,
            startFreshCompare: alignmentCheckInfo.startFreshAlignmentCheck,
            sourceCursor: sourceCursor,
            targetCursor: targetCursor,
            compareInBackground: alignmentCheckInfo.runInBackground,
            compareOptions: soaCompareOptionsList,
            notificationMessage: notificationMessage
        }
    };
};

/**
  * Process errors from response
  *
  * @param {Object} response - Server response
  * @returns {Object} null if response has error else response
  */
let processErrorsAndWarnings = function( response ) {
    let message = '';
    let level = 0;
    let error = response.ServiceData;
    if( error && error.partialErrors ) {
        _.forEach( error.partialErrors, function( partErr ) {
            if( partErr.errorValues ) {
                _.forEach( partErr.errorValues, function( errVal ) {
                    if( errVal.code ) {
                        if( message && message.length > 0 ) {
                            message += '\n' + errVal.message;
                        } else {
                            message += errVal.message;
                        }
                    }
                    level = errVal.level;
                } );
            }
        } );
        if( level <= 1 ) {
            messagingService.showInfo( message );
            return response;
        }
        exports.clearAlignmentCheckStatus();
        messagingService.showError( message );
        return null;
    }
};

/**
  *API to invoke compare content SOA
  *
  * @param {Object} compareInput - Compare input object
  * @returns {Object} The response object
  */
let _invokeSoa = function( compareInput ) {
    return soaService
        .postUnchecked( 'Internal-ActiveWorkspaceBom-2018-12-Compare', 'compareContent2', compareInput ).then(
            function( response ) {
                if( response.ServiceData && response.ServiceData.partialErrors ) {
                    return processErrorsAndWarnings( response );
                }
                return response;
            } );
};

let _getUnAlignedObjectUIDs = function( sourceDifference, targetDifference ) {
    let unalignedUids = [];
    let differences = { ...sourceDifference, ...targetDifference };
    for( const uid in differences ) {
        const differenceObj = differences[ uid ];
        if( differenceObj && ( differenceObj.status === 1 || differenceObj.status === 3 ) ) {
            unalignedUids.push( uid );
        }
    }
    return unalignedUids;
};

/**
  * Update collapsed objects differences
  * @param {object} fromDifference difference from which mapping uid to process
  * @param {object} toDifference difference to which maaping uids to add
  * @returns {object} Updated toDifference object
  */
let _updateCollapsedObjectsDiff = function( fromDifference, toDifference ) {
    for ( let key in fromDifference ) {
        let diffObj = fromDifference[ key ];

        if ( diffObj && diffObj.mappingUids.length > 0 ) {
            for ( let index = 0; index < diffObj.mappingUids.length; index++ ) {
                const mappingUid = diffObj.mappingUids[ index ];
                if ( !toDifference[ mappingUid ] ) {
                    let newDiffObj = _createDifferenceObject( mappingUid + '##' + key, diffObj.status );
                    toDifference[ mappingUid ] = newDiffObj.diff;
                }
            }
        }
    }
    return toDifference;
};

/**
  * Perform Alignment Check
  *
  * @param {Object} alignmentCheckInput - Alignment check input
  * @returns {Object} The response object
  */
let _performAlignmentCheck = function( alignmentCheckInput ) {
    return _invokeSoa( alignmentCheckInput ).then(
        function( response ) {
            if( response ) {
                if( alignmentCheckInput.inputData.compareInBackground ) {
                    _showBackgroundMessage();
                }

                let sourceDifference = _processDifferences( response.sourceDifferences, response.pagedSourceDifferences );
                let targetDifference = _processDifferences( response.targetDifferences, response.pagedTargetDifferences );
                targetDifference = _updateCollapsedObjectsDiff( sourceDifference, targetDifference );
                sourceDifference = _updateCollapsedObjectsDiff( targetDifference, sourceDifference );

                // Save Different in context
                let alignmentCheckInfo = {};
                alignmentCheckInfo.startFreshCompare = alignmentCheckInput.inputData.startFreshCompare;

                alignmentCheckInfo[ CBA_SRC_CONTEXT ] = alignmentCheckInput.inputData.source;
                alignmentCheckInfo[ CBA_SRC_CONTEXT ].differences = sourceDifference;

                alignmentCheckInfo[ CBA_TRG_CONTEXT ] = alignmentCheckInput.inputData.target;
                alignmentCheckInfo[ CBA_TRG_CONTEXT ].differences = targetDifference;

                alignmentCheckInfo.unalignedUIDs = _getUnAlignedObjectUIDs( sourceDifference, targetDifference );

                appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO, alignmentCheckInfo );

                let updatedResultObject = {
                    sourceIdsToUpdate: alignmentCheckInput.inputData.source.visibleUids,
                    targetIdsToUpdate: alignmentCheckInput.inputData.target.visibleUids
                };
                eventBus.publish( 'cba.alignmentCheckComplete', updatedResultObject );
            }
        } );
};

/**
  *Update compare status
  @param {String} contextKey - Context name for source or target
  @param {Array} uids array of uids
  @param {Object} supportedStatuses supportedStatuses
  */
export let updateAlignmentCheckStatus = function( contextKey, uids, supportedStatuses ) {
    let updateAlignmentCheckStatus = {};
    if( uids ) {
        let alignmentCheckInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO );
        let contextAlignmentCheckInfo = alignmentCheckInfo[ contextKey ];
        if( contextAlignmentCheckInfo ) {
            _.forEach( uids, function( uid ) {
                let diff = contextAlignmentCheckInfo.differences ? contextAlignmentCheckInfo.differences[ uid ] : null;
                _.forEach( supportedStatuses, function( supportedStatus ) {
                    if( !diff || _.indexOf( supportedStatus.statuses, diff.status ) > -1 ) {
                        if( !updateAlignmentCheckStatus[ uid ] ) {
                            updateAlignmentCheckStatus[ uid ] = [ supportedStatus.columnName ];
                        } else if( !updateAlignmentCheckStatus[ uid ][ supportedStatus.columnName ] ) {
                            updateAlignmentCheckStatus[ uid ].push( supportedStatus.columnName );
                        }
                    }
                } );
            } );
        }
    }
    eventBus.publish( 'viewModelObject.propsUpdated', updateAlignmentCheckStatus );
};

/**
  *Get default cursor for CBA
  *
  * @returns {Object} The default cursor object
  */
let _getCBADefaultCursor = function() {
    return {
        startReached: true,
        endReached: false,
        startIndex: 0,
        endIndex: 0,
        pageSize: 40,
        isForward: true
    };
};

/**
  * Unregister Events
  */
let _unRegisterEvents = function() {
    _.forEach( _eventSubDefs, function( subDef ) {
        if( subDef ) {
            eventBus.unsubscribe( subDef );
        }
    } );
    _eventSubDefs.length = 0;
};

/**
  * Check if passed value if valid value for difference
  *
  * @param {number} value - Value to check
  * @returns {boolean} - true if valid value else return false
  */
let _isValidValueOfDifference = function( value ) {
    return DIFFERENCES_VALID_VALUES.includes( value );
};

/**
  * Create difference object
  *
  * @param {String} key - Uid from response
  * @param {Integer} value - number representing the difference
  * @returns {Object} The difference object
  */
let _createDifferenceObject = function( key, value ) {
    let diff = {};
    let uid;
    diff.status = value;
    if( _isValidValueOfDifference( value ) ) {
        let uids = key.split( '##' );
        uid = uids.splice( 0, 1 );
        diff.mappingUids = uids;
    } else {
        uid = key;
    }
    return {
        uid: uid,
        diff: diff
    };
};

/**
  * Process the differences of given parameter
  * @param {Object} originalDifferences differences
  * @param {Object} pagedDifferences page differences
  *
  * @return {Object} differences
  */
let _processDifferences = function( originalDifferences, pagedDifferences ) {
    let diffs = {};
    if( originalDifferences ) {
        for( let key in originalDifferences ) {
            let obj = _createDifferenceObject( key, originalDifferences[ key ] );
            diffs[ obj.uid ] = obj.diff;
        }
    }

    if( pagedDifferences ) {
        _.forEach( pagedDifferences, function( pagedDifference ) {
            let obj = _createDifferenceObject( pagedDifference.uids, pagedDifference.diff );
            diffs[ obj.uid ] = obj.diff;
        } );
    }
    return diffs;
};

/**
  * Get Depth and background option for Alignment Check
  *
  * @param {Object} panelData - Alignment Check Setting Panel
  * @returns {Object} The depth and background option object
  */
let _getDepthAndBackgroundOption = function() {
    let dataObject = {};

    let defaultAlignmentCheckConfig = _getDefaultAlignmentCheckConfiguration();
    dataObject.depth = defaultAlignmentCheckConfig.displayLevel;
    dataObject.backgroundOption = defaultAlignmentCheckConfig.backgroundOption;

    if( dataObject.depth === CURRENT_LEVEL ) {
        dataObject.backgroundOption = false;
    }
    return dataObject;
};

let _subscribeEvents = function() {
    _eventSubDefs.push( eventBus.subscribe( 'entCBA.visibilityStateChanged', _visibilityChangeListener ) );
    _eventSubDefs.push( eventBus.subscribe( 'addElement.elementsAdded', _addElementListener ) );
    _eventSubDefs.push( eventBus.subscribe( 'cba.clearAlignmentCheckIndicators', _clearAlignmentCheckStatus ) );
};

/**
  *Initialize Service
  *
  */
export let initializeService = function() {
    _subscribeEvents();
};

/**
  * Un-register service when CBA page is closed
  *
  */
export let unRegisterService = function() {
    _sourceVMOs.length = 0;
    _targetVMOs.length = 0;
    _unRegisterEvents();
};

/**
  * Get status of given uid of context
  * @param {String} contextKey view key that represent the view
  * @param {object} vmo view model object
  * @return {number} status
  */
export let getStatus = function( contextKey, vmo ) {
    let status;

    let alignmentCheckInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO );
    if( alignmentCheckInfo ) {
        let contextAlignmentCheckInfo = alignmentCheckInfo[ contextKey ];
        if( contextAlignmentCheckInfo && contextAlignmentCheckInfo.differences ) {
            let diff = contextAlignmentCheckInfo.differences[ vmo.uid ];
            status = diff ? diff.status : null;
        }
    }
    if( !status && ( occmgmtUtils.isMinimumTCVersion( 13, 3 ) || occmgmtUtils.isMinimumTCVersion( 14, 0 ) ) ) {
        status = cbaFindAlignedService.getIndicatorStatus( contextKey, vmo );
    }
    return status;
};

/**
  * Execute alignment check from panel
  *
  * @param {Object} data - Alignment Check Setting panel view model
  */
export let executeAlignmentCheck = function() {
    let sourceVMOs = _getLoadedVMOjects( CBA_SRC_CONTEXT );
    let targetVMOs = _getLoadedVMOjects( CBA_TRG_CONTEXT );

    let depthBackgroundInfo = _getDepthAndBackgroundOption();
    let alignmentCheckInfo = _getAlignmentCheckInfoObject( depthBackgroundInfo.depth, depthBackgroundInfo.depth, sourceVMOs, targetVMOs,
        true, depthBackgroundInfo.backgroundOption, null );
    _executeAlignmentCheck( alignmentCheckInfo );
};

/**
  * Publish Background processing message
  */
let _showBackgroundMessage = function() {
    var resource = 'CadBomAlignmentMessages';
    var localeTextBundle = localeService.getLoadedText( resource );
    var infoMessage = localeTextBundle.BackgroundAlignmentCheckNotification;

    messagingService.showInfo( infoMessage );
};
/**
  * Open notification after background processing
  *
  * @param {Object} notificationObject - Notification Object data
  */
export let openCBANotification = function( notificationObject ) {
    if( notificationObject && notificationObject.object ) {
        let dataSetUID = notificationObject.object.uid;
        dataManagementService.getProperties( [ dataSetUID ], [ 'fnd0MessageBody' ] ).then(
            function( response ) {
                let dataSetObject = response && response.modelObjects ? response.modelObjects[ dataSetUID ] : null;
                if( dataSetObject ) {
                    appCtxSvc.updatePartialCtx( 'cbaContext.alignmentCheckContext.dataSetUID', dataSetUID );

                    // If we are already in CBA page and we are trying to navigate to CBA page again from alert notification..
                    // Then we need to gaurd CBA context variables being cleaned up from context.
                    // The execution flow is as follows:
                    // 1. The navigation request routes to CBA page and hence loadCBAData API gets invokes
                    // 2. This API populates CBA context variables as per the new navigation request for new src and trg uids.
                    // 3. Then the framework unloads old CBA page becuase the new navigation request will inject new CBA page
                    // 4. At this point, becuase of old CBA page unloads; the CBA context variables set for new request in step 2 are cleared
                    // 5. so just set an indication for the execution flow that we are trying to navigate to same page and hence doNotClearCBAContextVars
                    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_DO_NOT_CLEAR_CBA_VARS, true );
                    let toParams = CadBomAlignmentUtil.getURLParametersFromDataset( dataSetObject );

                    let transitionTo = 'CADBOMAlignment';
                    let options = {};
                    options.reload = true;
                    locationNavigationService.instance.go( transitionTo, toParams, options );
                }
            }
        );
    }
};

/**
  * Clear Alignment Indicators
  */
let _clearAlignmentCheckStatus = function() {
    appCtxSvc.updatePartialCtx( 'cbaContext.alignmentCheckContext.alignmentCheckInfo', {} );
    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, {} );
    eventBus.publish( 'cba.refreshTree' );
};

/**
  * Clear Alignment Indicators
  * @param {String} dataProviderActionType - dataProviderActionType for event data of productContextChangedEvent
  */
export let clearAlignmentCheckStatus = function( dataProviderActionType ) {
    if( _.isUndefined( dataProviderActionType ) || dataProviderActionType === 'initializeAction' ) {
        _clearAlignmentCheckStatus();
    }
};

/**
  * Get executed alignment check info for the context
  *
  * @param {*} contextKey - Source or Target Context key for which last alignment check info to fetch
  * @returns {Object} - Alignment Check info object
  */
let _getExecutedAlignmentCheckInfo = function( contextKey ) {
    return appCtxSvc.getCtx( 'cbaContext.alignmentCheckContext.alignmentCheckInfo.' + contextKey );
};

/**
  * Re-Execute alignment check after alignment or unalignment
  *
  * @param {Object} updatedIds - List of updated uids
  * @param {boolean} isStructureUpdated true if structure is updated with Created or Deleted lines else false
  */
export let reExecuteAlignmentCheck = function( updatedIds, isStructureUpdated ) {
    let srcContextObj = _getExecutedAlignmentCheckInfo( CBA_SRC_CONTEXT );
    let trgContextObj = _getExecutedAlignmentCheckInfo( CBA_TRG_CONTEXT );

    // If NO alignment check is perfomed then no need to re-execute alignment check
    if( !srcContextObj || !trgContextObj ) {
        return;
    }

    // Check if updated element is same as alignment check context
    let isExecuteAlignmentCheck = _isTopAlignment( updatedIds );
    if( !isStructureUpdated && !isExecuteAlignmentCheck && ( updatedIds.includes( srcContextObj.element.uid ) || updatedIds.includes( trgContextObj.element.uid ) ) ) {
        exports.clearAlignmentCheckStatus();
        return;
    }

    if( !isExecuteAlignmentCheck ) {
        for( let index = 0; index < updatedIds.length; index++ ) {
            const element = updatedIds[ index ];

            // Check if alignment check is done for updated element.
            if( srcContextObj.differences.hasOwnProperty( element ) || trgContextObj.differences.hasOwnProperty( element ) ) {
                isExecuteAlignmentCheck = true;
                break;
            }
        }
    }

    if( isExecuteAlignmentCheck ) {
        let sourceDepth = srcContextObj.depth;
        let targetDepth = trgContextObj.depth;

        let sourceVMOs = _getLoadedVMOjects( CBA_SRC_CONTEXT );
        let targetVMOs = _getLoadedVMOjects( CBA_TRG_CONTEXT );

        let alignmentCheckInfo = _getAlignmentCheckInfoObject( sourceDepth, targetDepth, sourceVMOs, targetVMOs,
            true, false, null, null, srcContextObj.element, trgContextObj.element );
        _executeAlignmentCheck( alignmentCheckInfo );
    } else {
        exports.clearAlignmentCheckStatus();
    }
};

/**
  * check weather given uids are of top node alignment
  *
  * @param {Object} uids - List of uids
  *
  * @returns {Boolean} true if given uid are for top alignment
  */
export let _isTopAlignment = function( uids ) {
    let trgTop = appCtxSvc.getCtx( cbaConstants.CBA_TRG_CONTEXT );
    let srcTop = appCtxSvc.getCtx( cbaConstants.CBA_SRC_CONTEXT );
    if( trgTop && trgTop.topElement && srcTop && srcTop.topElement &&
         ( uids.includes( trgTop.topElement.uid ) || uids.includes( srcTop.topElement.uid ) ) ) {
        return true;
    }
    return false;
};

/**
  * Check if node is being expanded or not
  * @param {object} subPanelContext SubPanelContext either for Source or Target
  * @returns {boolean} - True if node is being expanded, false otherwise
  */
let _isExpansionCase = function( subPanelContext ) {
    let lastDpAction = subPanelContext.searchState.lastDpAction;
    return lastDpAction === 'nextAction' || lastDpAction === 'focusAction';
};

/**
  * Get property value for specified path from given object
  *
  * @param {string} contextName - Source or target context name from which get affected UID.
  * If no context passed then it will return from all availabel contexts.
  * @param {string} secondarySelections - Secondary uids for which affected uid to fetch
  * @param {boolean} isTopAlignment - true if top node alignment else false
  * @returns {Array} - List of affacted uids
  */
export let getAffectedObjectUIDPostPartCADAlignmentUpdate = function( contextName, secondarySelections, isTopAlignment ) {
    let affectedUIDs = [];
    let primarySelection = appCtxSvc.getCtx( contextName + '.selectedModelObjects[0].uid' );

    if( isTopAlignment ) // secondarySelections will be empty
    {
        let viewKeys = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_VIEWKEYS );
        let diffArray = _.difference( viewKeys, [ contextName ] );
        let inActiveContextKey = diffArray[ 0 ];
        let secondarySelection = appCtxSvc.getCtx( inActiveContextKey + '.selectedModelObjects[0].uid' );
        affectedUIDs.push( secondarySelection );
    } else {
        _.forEach( secondarySelections, function( secondarySelection ) {
            let fnd0UnderlyingObjectUid = CadBomAlignmentUtil.getPropertyValueFromObject( secondarySelection, 'props.fnd0UnderlyingObject.dbValue' );
            affectedUIDs.push( fnd0UnderlyingObjectUid );
        } );
        affectedUIDs = CadBomOccurrenceAlignmentUtil.getLoadedVMO( affectedUIDs );
    }
    affectedUIDs.push( primarySelection );
    return affectedUIDs.reverse();
};

/**
  *  Check if alignment check is performed on node being expand or any of it's parent node.
  * @param {object} expandedParentNode Node being expand
  * @param {string} contextName Source or Target context from which node is expanding
  * @param {object} differences Alignemtn Check data for given context
  * @param {string} partDesignRequiredProp pma1IsDesignRequired or pma1IsPartRequired property based on context.
  * @returns {boolean} true if expanding node or its parent if alignment check is performed .
  */
let _isAlignmentCheckPerformed = function( expandedParentNode, contextName, differences, partDesignRequiredProp ) {
    let isResult = false;
    if( differences ) {
        const nodeProps = expandedParentNode.props;
        if( nodeProps && nodeProps[ partDesignRequiredProp ].dbValue ) {
            if( !differences.hasOwnProperty( expandedParentNode.uid ) ) {
                const parentNodeProp = _.get( expandedParentNode, 'props.awb0Parent' );
                const activeContext = appCtxSvc.ctx[ contextName ];
                const vmc = activeContext.vmc;
                const parentTreeNode = vmc.getViewModelObject( vmc.findViewModelObjectById( parentNodeProp.dbValues[ 0 ] ) );
                if( parentTreeNode ) {
                    isResult = _isAlignmentCheckPerformed( parentTreeNode, contextName, differences, partDesignRequiredProp );
                }
            } else {
                isResult = true;
            }
        }
    }
    return isResult;
};

/**
  *  Perform alignment check for cached node if caches node don't have alignment data
  * @param {object} expndedNode Tree node which is expanding
  * @param {string} contextName Source or Target context from which node is expanding
  * @param {string} partDesignRequiredProp pma1IsDesignRequired or pma1IsPartRequired property based on context.
  */
export let performAlignmentCheckForCachedNode = function( expndedNode, contextName, partDesignRequiredProp ) {
    if( expndedNode.children && expndedNode.children.length ) {
        const alignmentCheckInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO );
        if( alignmentCheckInfo ) {
            const contextAlignmentCheckInfo = alignmentCheckInfo[ contextName ];
            if( contextAlignmentCheckInfo && contextAlignmentCheckInfo.differences ) {
                const differences = contextAlignmentCheckInfo.differences;
                let isParentAlignmentCheckDone = _isAlignmentCheckPerformed( expndedNode, contextName, differences, partDesignRequiredProp );
                if( isParentAlignmentCheckDone ) {
                    let isPerformAlignmentCheck = false;
                    for( let index = 0; index < expndedNode.children.length; index++ ) {
                        const child = expndedNode.children[ index ];
                        if( child.props && child.props[ partDesignRequiredProp ].dbValue && !differences.hasOwnProperty( child.uid ) ) {
                            isPerformAlignmentCheck = true;
                            break;
                        }
                    }
                    if( isPerformAlignmentCheck ) {
                        _executeAlignmentCheckOnNodeExpansion();
                    }
                }
            }
        }
    }
};

/**
  * CAD-BOM Occurrence Alignment Check service
  */
export default exports = {
    CBA_SRC_CONTEXT,
    CBA_TRG_CONTEXT,
    updateAlignmentCheckStatus,
    initializeService,
    unRegisterService,
    getStatus,
    executeAlignmentCheck,
    openCBANotification,
    clearAlignmentCheckStatus,
    reExecuteAlignmentCheck,
    getAffectedObjectUIDPostPartCADAlignmentUpdate,
    performAlignmentCheckForCachedNode
};

