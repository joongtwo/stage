// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0Scopes View
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/pca0ScopesService
 */
import appCtxSvc from 'js/appCtxService';
import commonUtils from 'js/pca0CommonUtils';
import configuratorUtils from 'js/configuratorUtils';
import eventBus from 'js/eventBus';
import iconsvc from 'js/iconService';
import Pca0Constants from 'js/Pca0Constants';
import _ from 'lodash';

var exports = {};

var _scopes = null;
var _scopesVMOList = null;
let _scopeSelectionChanged;

/**
 * This API create a scope VMO object
 *
 * @param {Object} scope - The scope object
 * @returns {Object} - Returns VMO of scope object
 */
let _createVMO = function( scope ) {
    if( scope.vmo !== undefined && ( scope.sourceUid !== Pca0Constants.PSUEDO_GROUPS_UID.PRODUCTS_GROUP_UID || scope.sourceUid !== Pca0Constants.PSUEDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) ) {
        return scope.vmo;
    }

    var groupIconName;
    if( scope.sourceUid === Pca0Constants.PSUEDO_GROUPS_UID.PRODUCTS_GROUP_UID ) {
        groupIconName = Pca0Constants.CFG_OBJECT_TYPES.TYPE_MODEL_FAMILY_GRP_REVISION;
    } else if( scope.sourceUid === Pca0Constants.PSUEDO_GROUPS_UID.UNASSIGNED_GROUP_UID ) {
        groupIconName = Pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GRP_REVISION;
    } else {
        groupIconName = Pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GRP_REVISION;
    }
    var imageIconUrl = iconsvc.getTypeIconURL( groupIconName );
    if( !imageIconUrl ) {
        //in case this is empty, add the default icon as type missing
        imageIconUrl = iconsvc.getTypeIconURL( Pca0Constants.CFG_OBJECT_TYPES.TYPE_MISSING );
    }
    return {
        objectID: scope.optGroup,
        uid: scope.optGroup,
        name: scope.groupDisplayName,
        cellHeader1: scope.groupDisplayName,
        cellHeader2: scope.groupDescription,
        typeIconURL: imageIconUrl,
        getId: function() {
            return this.uid;
        }
    };
};

/**
 * This API is called when Variant Configuration tab is loaded (scopes are loaded for the first time)
 * and change in loaded Variant Rule occurs (either new loaded rule or removed)
 * Force selection of first Scope
 * @param {Object} data - The view data
 * @param {Object} scopeSelection - The atomic data for scope selection
 * @param {String} scopeUid - The scopeUid optional; if not defined the first one is set
 */
let _selectScopeByUid = function( data, scopeSelection, scopeUid ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    var selectionModel = data.dataProviders.scopesListDataProvider.selectionModel;

    if( _scopesVMOList && _scopesVMOList.length > 0 ) {
        var currentScopeUidIndex = 0;
        if( !_.isUndefined( scopeUid ) ) {
            currentScopeUidIndex = _.findIndex( _scopesVMOList, ( vmo ) => vmo.uid === scopeUid );
        }
        if( currentScopeUidIndex > -1 ) {
            var newSelectionUid = _scopesVMOList[ currentScopeUidIndex ].uid;
            fscContext.currentScope = newSelectionUid; // This way, handleScopeSelectionChange method won't fire loadScopeData
            // update the state of the parent and avoid having to use global context and events
            fscContext.currentScopeName = _scopesVMOList[ currentScopeUidIndex ].cellHeader1;
            //it should be using name like below but for loaded svr not set, we'll have to adjust. It should use selection.selected[ 0 ].name
            var expandedFamilies;
            if( data.soaResponse ) {
                var firstGroupInResponse = _.find( commonUtils.getVariabilityNodes( data.soaResponse ), { nodeUid: newSelectionUid } );
                expandedFamilies = firstGroupInResponse.childrenUids;
            }
            //check to see if the cached response is on the first group, otherwise go ahead with the selection
            //and subsequently require a fresh load of features
            if( ( !_.isUndefined( scopeUid ) || !expandedFamilies || expandedFamilies.length === 0 ) && scopeSelection && scopeSelection.update ) {
                let newscopeSelection = { ...scopeSelection.value };
                newscopeSelection.currentScopeSelectionUid = newSelectionUid;
                scopeSelection.update( newscopeSelection );
                selectionModel.setSelection( _scopesVMOList[ currentScopeUidIndex ] );
            } else {
                // Refresh middle panel with data coming from 1st scope/group
                // soaResponse when loading all scopes contains information on 1st group
                // Cache soaReponse, to be used in MiddlePanel without calling unnecessary SOA
                eventBus.publish( 'Pca0Features.loadCachedScope', { soaResponse: data.soaResponse } );
            }
        }
    }
    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
};

/**
 * This API is responsible for triggering actions to initialize configuration data
 *
 * @param {Object} data - The view data
 * @param {Boolean } applySettings - flag for apply settings
 */
export let getConfigurationData = function( data, applySettings ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    // Note: when entering FSC with loaded SVR/CBOS, event "Pca0Scopes.loadedSVRChanged" was fired
    // but Active Settings are not fetched yet: SKIP all actions
    if( data.eventMap && Object.keys( data.eventMap ).indexOf( 'Pca0Scopes.loadedSVRChanged' ) !== -1 ) {
        delete data.eventMap[ 'Pca0Scopes.loadedSVRChanged' ];

        // Scenario: entering FSC with SVR/CBOS
        if( _.isUndefined( data.eventData ) && ( _.isUndefined( fscContext.appliedSettings ) || Object.keys( fscContext.appliedSettings ).length === 0 ) ) {
            return;
        }
        // Scenario: loading SVR
        if( !applySettings ) {
            delete fscContext.appliedSettings;
        }
    }
};

/**
 * This API processes the server response and constructs the client data model
 *
 * @param {Object} response - The response received by SOA service
 * @param {Object} data - The view data
 * @param {Object} scopeSelection - The atomic data for scope selection
 * @returns {Object} - Returns the option group objects which will be rendered on scopes panel
 */
export let getScopesData = function( response, data, scopeSelection ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    // Delete reassessSelections from context now that configuration data has been refreshed
    // It might have been set when updating settings
    delete fscContext.reassessSelections;

    if( _.isEmpty( response.variabilityTreeData ) ) {
        _scopesVMOList = null;
        eventBus.publish( 'Pca0Scopes.noVariabilityReasons', {} );

        delete fscContext.currentScope;
        var selectionModel = data.dataProviders.scopesListDataProvider.selectionModel;
        selectionModel.setSelection( [] );
        eventBus.publish( 'Pca0Features.clearScopeData' );
        eventBus.publish( 'Pca0FullScreenSummary.loadVariantData', {} );
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );

        return;
    }
    _scopes = configuratorUtils.populateScopes( response );

    var scopes = [];
    for( var i = 0; i < _scopes.length; i++ ) {
        var scopeVMO = _createVMO( _scopes[ i ] );
        scopes.push( scopeVMO );
    }
    _scopesVMOList = scopes;

    // Select First Scope
    data.soaResponse = response;

    if( !_scopeSelectionChanged ) {
        _scopeSelectionChanged = eventBus.subscribe( 'scopesListDataProvider.selectionChangeEvent',
            function( eventData ) {
                handleScopeSelectionChange( eventData, scopeSelection );
            } );
    }

    //select the current set scope - this is the case when the window resizes to the vertical layout or back to horizontal
    //and there are things already selected on the scope
    if( _scopesVMOList && _scopesVMOList.length > 0 && fscContext.currentScope && fscContext.currentScope !== _scopesVMOList[ 0 ].uid ) {
        _selectScopeByUid( data, scopeSelection, fscContext.currentScope );
    } else {
        //load first scope
        _selectScopeByUid( data, scopeSelection );
    }

    return scopes;
};
/**
 * Handles scope selection change event
 *
 * @param {Object} selection - The selected scope object
 * @param {Object} scopeSelection - The atomic data for scope selection
 */
export let handleScopeSelectionChange = function( selection, scopeSelection ) {
    var fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );

    if( selection.selectedUids.length > 0 && !_.isEmpty( fscContext.currentScope ) && selection.selectedUids[ 0 ] !== fscContext.currentScope ) {
        //leave the stuff on fsc Context for now but also move it into atomic data and start consuming from there
        fscContext.currentScope = selection.selectedUids[ 0 ];
        //save the name as well, it is needed for setting selections in the selection map because summary panel compares against it
        fscContext.currentScopeName = selection.selected[ 0 ].cellHeader1;
        //maria todo: it should be using name like below but for loaded svr not set, check why
        //fscContext.currentScopeName = selection.selected[ 0 ].name;

        // update the state of the parent and avoid having to use global context and events
        if( scopeSelection && scopeSelection.update ) {
            let newscopeSelection = { ...scopeSelection.value };
            // set the new selection on the parent/ features is observing it and will be able to react
            newscopeSelection.currentScopeSelectionUid = selection.selectedUids[ 0 ];
            scopeSelection.update( newscopeSelection );
        }

        // This method is called both when
        // - navigating to a required family with change of scope/group required (guided navigation with prev/next commands)
        // - when user manually changes scope
        // In both cases, reset information on active family
        // (but keep target navigation data: navigateTo is unchanged)
        delete fscContext.activeFamilyUID;

        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
    }
};

export let getSelectionForVariantContext = function( context ) {
    return configuratorUtils.getSelectionForVariantContext( context );
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - variantRuleData
 * @return {Object} configPerspective - fsc config  perspective
 */
export let getConfigPerspective = function( variantRuleData ) {
    return configuratorUtils.getFscConfigPerspective( variantRuleData );
};

/**
 * This API returns initialVariantRule only when selections are undefined
 *
 * @returns {String} initialVariantRule - Returns the currently active variant rule
 */
export let getActiveVariantRules = function() {
    return configuratorUtils.getFscActiveVariantRules();
};

/**
 * Get configuration mode
 * @param {Object} fscCtxName - The fsc Context Name
 * @param {Object} fscState - The fscState
 * @returns {String} configuration mode
 */
export let getConfigurationMode = function( fscCtxName, fscState ) {
    // If platform verson is 12.4 or later and a variant rule is applied then open that variant rule diretly in manual mode
    var fscContext = appCtxSvc.getCtx( fscCtxName );
    if( configuratorUtils.isPlatformVersionAtleast124() &&
        configuratorUtils.getFscActiveVariantRules() !== null &&
        fscState && fscState.update ) {
        let newState = { ...fscState.value };
        newState.isManualConfiguration = true;
        fscState.update( newState );
        fscContext.guidedMode = false;
        appCtxSvc.updateCtx( fscCtxName, fscContext );
    }
    return configuratorUtils.getConfigurationMode( fscCtxName );
};
/**
 * Return Profile Settings information
 * @returns {Object} - Returns profile settings
 */
export let getProfileSettings = function() {
    return configuratorUtils.getProfileSettingsForFsc();
};

/**
 * This API is called when user wants referesh/update all groups in scope view
 * @param {Object} data - The view data
 * @returns {Array} List of scopes
 */
export let refreshGroupsInScopeView = function( data ) {
    let dataProvider = data.dataProviders.scopesListDataProvider;
    let scopes = [];
    let eventData = commonUtils.getEventDataFromEventMap( data.eventMap, 'Pca0Scopes.updateGroups' );

    _scopes = eventData.updatedGroupsList;
    if( _scopes ) {
        for( var i = 0; i < _scopes.length; i++ ) {
            var scopeVMO = _createVMO( _scopes[ i ] );
            scopes.push( scopeVMO );
        }
        _scopesVMOList = scopes;
        if( dataProvider && dataProvider.viewModelCollection && dataProvider.viewModelCollection.totalObjectsLoaded !== scopes.length ) {
            dataProvider.update( scopes, scopes.length );
        }

        return scopes;
    }
};

/**
 * This API is called when user want retain current scope selection in scope view
 *
 * @param {Object} data - The view data
 */
export let selectCurrentScope = function( data ) {
    let fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let selectionModel = data.dataProviders.scopesListDataProvider.selectionModel;
    let currentScopeVMO;
    for( const iterator of data.scopes ) {
        if( iterator.uid === fscContext.currentScope || _.isEmpty( fscContext.currentScope ) ) {
            currentScopeVMO = iterator;
            break;
        }
    }
    if( currentScopeVMO ) {
        selectionModel.setSelection( currentScopeVMO );
    }
};

/**
 * Sets the state fiollowing a mode change
 * @param {Object} response - response
 * @param {Object} fscState - The fscState
 * @returns {Object} - Returns profile settings
 */

export let renderToggleMode = function( response, fscState ) {
    // Hide Toggle mode if required minimum platform version is not greater than or equal to 11.4
    // We'll hold this information in variantConfigContext in appcontext so that main view where toggle
    // is displayed can access this.

    // Update application context
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( context ) {
        let isManualModeSupported = configuratorUtils.isPlatformVersionSupported();
        // uncomment the platform support check for validation, once baseline is available
        let isPlatformGreaterThan11503 = configuratorUtils.isPlatformGreaterThan11503();
        context.isPlatformGreaterThan11503 = isPlatformGreaterThan11503;
        appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, context );

        if( fscState && fscState.update ) {
            let newState = { ...fscState.value };
            newState.isManualModeSupported = isManualModeSupported;
            newState.isPlatformGreaterThan11503 = isPlatformGreaterThan11503;
            if( isManualModeSupported && ( context.guidedMode === true || context.guidedMode === undefined ) ) {
                // we initialize isManualConfiguration to false when we know manual configuration is supported.
                // it is initialized to false because we land to the configuration panel in guided mode.
                newState.isManualConfiguration = false;
            }
            fscState.update( newState );
        }
    }
};

/**
 * Reset isSwitchingFromGridToListView flag when configuration view is switched from grid to list view
 * @param {Object} fscState - The atomic data for fscState
 */
export let resetIsSwitchingFromGridToListViewFlag = function( fscState ) {
    if( fscState && fscState.update ) {
        let newState = { ...fscState.value };
        //do not trigger unnecessary updates
        if( newState.isSwitchingFromGridToListView ) {
            newState.isSwitchingFromGridToListView = false;
            fscState.update( newState );
        }
    }
};

/**
 * Unregister all event listeners for Custom "FSC" behavior in Search Panel
 */
export let cleanUp = function() {
    if( _scopeSelectionChanged ) {
        eventBus.unsubscribe( _scopeSelectionChanged );
        _scopeSelectionChanged = undefined;
    }
};

/**
 * Returns the switchingToGuidedMode flag
 * @returns {string} - flag as string
 */
export let getSwitchingToGuidedMode = function() {
    var context = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    if( context && context.switchingToGuidedMode ) {
        return 'true';
    }
    return 'false';
};

/**
 * Get previous scope, given input scope UID.
 * If top of list is reached, get last element
 * @param {String} groupUID - input group UID, next to be found starting from it
 * @returns {String} next group UID
 */
export let getPreviousScope = function( groupUID ) {
    let currentIdx = _.findIndex( _scopes, function( scope ) {
        return scope.optGroup === groupUID;
    } );
    let prevIdx = currentIdx - 1;
    if( prevIdx === -1 ) {
        prevIdx = _scopes.length - 1;
    }
    return _scopes[ prevIdx ].optGroup;
};

/**
 * Get next scope, given input scope UID.
 * If end of list is reached, get first element
 * @param {String} groupUID - input group UID, next to be found starting from it
 * @returns {String} next group UID
 */
export let getNextScope = function( groupUID ) {
    let currentIdx = _.findIndex( _scopes, function( scope ) {
        return scope.optGroup === groupUID;
    } );
    let nextIdx = currentIdx + 1;
    if( nextIdx === _scopes.length ) {
        nextIdx = 0;
    }
    return _scopes[ nextIdx ].optGroup;
};

/**
 * Select group on Scopes DataProvider
 * Get current Group selection and setSelection if different
 * @param {UwDataProvider} dataProvider Scopes Data Provider
 * @param {Object} scopeUID Navigation Target Scope
 */
export let selectScope = function( dataProvider, scopeUID ) {
    var vmc = dataProvider.viewModelCollection;
    var index = vmc.findViewModelObjectById( scopeUID );
    //if the currentSelection reset, go back to first one
    if( index < 0 ) {
        //dataProvider.selectionModel.selectNone();
        index = 0;
    }
    var vmo = vmc.getViewModelObject( index );
    dataProvider.selectionModel.setSelection( vmo );
};

/**
 * Reset resetVariantState after variant gets saved or unloaded
 * @param {Object} fscState - The atomic data for fscState
 */
export let resetVariantState = function( fscState ) {
    if( fscState && fscState.update ) {
        let newState = { ...fscState.value };
        //do not trigger unnecessary updates
        if( newState.savedVariant || newState.unloadedVariant ) {
            newState.savedVariant = false;
            newState.unloadedVariant = false;
            fscState.update( newState );
        }
    }
};
/**
 * Convert selected expression json object to selected expression json string array.
 * for ex.
 * {
 * objectUid1:  [ ConfigExprSet: [] ],
 * objectUid2: [ ConfigExprSet: [] ],
 * objectUid3: [ ConfigExprSet: [] ]
 * }
 * will be converted to
 *
 * [
 * { objectUid1: [ ConfigExprSet: [] ] },
 * { objectUid2: [ ConfigExprSet: [] ] },
 * { objectUid3: [ ConfigExprSet: [] ] }
 * ]
 * @param {Object} selectedExpressions - selected expression json object
 * @returns {Array} Array of json string of selected expressions.
 */
export let convertSelectedExpressionJsonObjectToString = function( selectedExpressions ) {
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( selectedExpressions );
};

/**
 * Set the scope to first group. Currently this function is triggered for 3 cases
 * 1. When we are not in 1st group
 *      i. Apply settings
 *      ii. Load SVR
 *      iii. Unload SVR
 * @param {Object} scopeSelection - The atomic data for scope selection
 */
export let setSelectionScopeToFirstGroup = function( scopeSelection ) {
    // set currentScope to 1st group so that handleScopeSelectionChange doesn't cause selection.
    let fscContext = appCtxSvc.getCtx( 'fscContext' );
    delete fscContext.activeFamilyUID;
    fscContext.currentScope = '';
    fscContext.currentScopeName = '';


    appCtxSvc.updateCtx( Pca0Constants.FSC_CONTEXT, fscContext );
    let newscopeSelection = { ...scopeSelection.value };
    // Set the current scope selection Uid to '' so that it selectScope function sets the
    // selection to 1st group
    newscopeSelection.currentScopeSelectionUid = '';
    scopeSelection.update( newscopeSelection );
};
export default exports = {
    getConfigurationData,
    getScopesData,
    handleScopeSelectionChange,
    getSelectionForVariantContext,
    getActiveVariantRules,
    getConfigurationMode,
    getProfileSettings,
    refreshGroupsInScopeView,
    selectCurrentScope,
    renderToggleMode,
    resetIsSwitchingFromGridToListViewFlag,
    cleanUp,
    getSwitchingToGuidedMode,
    getPreviousScope,
    getNextScope,
    selectScope,
    convertSelectedExpressionJsonObjectToString,
    getConfigPerspective,
    resetVariantState,
    setSelectionScopeToFirstGroup
};
