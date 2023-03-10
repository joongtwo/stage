// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtRequestPrefPopulatorService
 */
import clientDataModelSvc from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import _ from 'lodash';
import localStorage from 'js/localStorage';
import declUtils from 'js/declUtils';

const PRODUCTS_OPENED_IN_SPLITVIEW_UIDS = 'productsOpenedInSplitView';
var _LS_TOPIC_INDEX_OFF_LIST = 'awAwbIndexOffList';
var _TRUE = [ 'true' ];
var _FALSE = [ 'false' ];

var IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

var _getObject = function( uid ) {
    if( clientDataModelSvc.isValidObjectUid( uid ) ) {
        var obj = clientDataModelSvc.getObject( uid );

        if( !obj ) {
            return new IModelObject( uid, 'unknownType' );
        }

        return obj;
    }

    return new IModelObject( clientDataModelSvc.NULL_UID, 'unknownType' );
};

/**
 * Method checks if the AppSession is opened
 */
let isAppSessionType = function() {
    return appCtxService.ctx.occmgmtContext &&
        appCtxService.ctx.occmgmtContext.modelObject &&
        appCtxService.ctx.occmgmtContext.modelObject.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) >= 0;
};

/**
 * Method checks if the Workset is opened
 */
let isWorksetType = function() {
    return appCtxService.ctx.occmgmtContext &&
        appCtxService.ctx.occmgmtContext.modelObject &&
        appCtxService.ctx.occmgmtContext.modelObject.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) >= 0;
};

var exports = {};

export let populateExpansionCriteriaParameters = function( expansionCriteria, occContext ) {
    if( occContext.transientRequestPref.expandBelow ) {
        expansionCriteria.expandBelow = occContext.transientRequestPref.expandBelow.toString() === 'true';
    }
    if( occContext.transientRequestPref.loadTreeHierarchyThreshold ) {
        expansionCriteria.loadTreeHierarchyThreshold = parseInt( occContext.transientRequestPref.loadTreeHierarchyThreshold, 10 );
    }
    if( occContext.transientRequestPref.scopeForExpandBelow ) {
        expansionCriteria.scopeForExpandBelow = occContext.transientRequestPref.scopeForExpandBelow;
    }
    if( occContext.transientRequestPref.levelsToExpand ) {
        expansionCriteria.levelNExpand = parseInt( occContext.transientRequestPref.levelsToExpand, 10 );
    }
};

export let populateExpansionCriteriaParameters2 = function( expansionCriteria, expansionContext ) {
    if( expansionContext.expandBelow !== undefined ) {
        expansionCriteria.expandBelow = expansionContext.expandBelow;
    }
    if( expansionContext.loadTreeHierarchyThreshold !== undefined ) {
        expansionCriteria.loadTreeHierarchyThreshold = parseInt( expansionContext.loadTreeHierarchyThreshold, 10 );
    }
    if( expansionContext.scopeForExpandBelow !== undefined ) {
        expansionCriteria.scopeForExpandBelow = expansionContext.scopeForExpandBelow;
    }
    if( expansionContext.levelsToExpand !== undefined ) {
        expansionCriteria.levelNExpand = parseInt( expansionContext.levelsToExpand, 10 );
    }
};

export let populateRequestPrefParametersFromLoadInput = function( requestPref, loadInput ) {
    requestPref.displayMode = [ loadInput.displayMode ];

    if( !_.isEmpty( loadInput.sortCriteria ) ) {
        requestPref.propertyName = [ loadInput.sortCriteria[ 0 ].fieldName ];
        requestPref.sortDirection = [ loadInput.sortCriteria[ 0 ].sortDirection ];
    }

    if ( !_.isEmpty( loadInput.openOrUrlRefreshCase ) && loadInput.openOrUrlRefreshCase === 'urlRefresh' ) {
        requestPref.refresh = [ 'true' ];
    }

    /**
       * Determine loading direction.
       */
    if( !declUtils.isNil( loadInput.addAfter ) && !loadInput.addAfter ) {
        requestPref.goForward = _FALSE;
    }
};

export let populateRequestPrefParametersFromContext = function( requestPref, currentContext, config, occContext ) {
    // If the current structure has ACE filters applied then we need to create new window upon configuration change
    if( currentContext.previousFilterValue && currentContext.previousFilterValue.length > 0 ) {
        requestPref.createWindow = _TRUE;
    }
    currentContext.previousFilterValue = AwStateService.instance.params.filter;

    //TODO find a better way to handle the Unassigned server call
    //TODO : MFE code. This should follow new pattern of PLM700341

    if( appCtxService.ctx.splitView && appCtxService.ctx.requestPref && appCtxService.ctx.requestPref.unassignedMode === true && currentContext.urlParams.rootQueryParamKey === 'uid2' ) {
        requestPref.unassignedMode = _TRUE;
        if( !occContext.transientRequestPref.expandBelow ) {
            currentContext.transientRequestPref.startFreshNavigation = true;
        }
    }

    _.forEach( currentContext.persistentRequestPref, function( value, name ) {
        if( !_.isUndefined( value ) ) {
            requestPref[ name ] = [ value.toString() ];
        }
    } );

    if( currentContext.requestPref ) {
        _.forEach( currentContext.requestPref, function( value, name ) {
            if( !_.isUndefined( value ) ) {
                if( _.isArray( value ) ) {
                    requestPref[ name ] = value;
                } else {
                    requestPref[ name ] = [ value.toString() ];
                }
            }
        } );

        //TODO : calculateFilters should goto requestePref definition in occurrenceManagementViewModel.json n its flavors
        requestPref.calculateFilters = currentContext.requestPref.calculateFilters === true ? _TRUE : _FALSE;

        if( currentContext.requestPref.replayRecipe ) {
            requestPref.replayRecipe = [ currentContext.requestPref.replayRecipe ];
            requestPref.currentSelections = currentContext.pwaSelectionModel.getSelection();
        }

        if( ( !appCtxService.ctx.variantRule || !appCtxService.ctx.variantRule.changeRule ) &&
          occContext && occContext.configContext !== undefined && occContext.configContext.r_uid !== undefined &&
              currentContext.supportedFeatures && currentContext.supportedFeatures.Awb0ConfiguredByProximity ) {
            requestPref.configByProximityTarget = _TRUE;
        }

        // If quick search strings are present, then populate same in requestPref
        if( currentContext.requestPref.categorysearchcriteria ) {
            requestPref.categorySearchCriteria = [ currentContext.requestPref.categorysearchcriteria ];
        }

        if( currentContext.requestPref.addUpdatedFocusOccurrence ) {
            requestPref.addUpdatedFocusOccurrence = _TRUE;
        }

        if( currentContext.requestPref.filterOrRecipeChange ) {
            requestPref.filterOrRecipeChange = _TRUE;
        }
    }

    //View information identified in three different ways
    //1. User changes view from configuration panel - the new view information is present in transientRequestPref and is being passed in request preference using generic code.
    //2. User once changed View and doing drill down, filter use case - pass the view information available in PCI property
    //3. User changes role - pass view with empty string so that view information extracted from TC preference
    //Client propcessing will be simplified via tech dept story B-47954
    if( currentContext.transientRequestPref && _.isUndefined( currentContext.transientRequestPref.viewType ) && clientDataModelSvc.isValidObjectUid( currentContext.currentState.pci_uid ) ) { //Pass exisitng view information in all follow-up request
        var pci = _getObject( currentContext.currentState.pci_uid );
        if( pci.props && pci.props.fgf0ViewList ) {
            if( pci.props.fgf0ViewList.dbValues.length > 0 ) {
                requestPref.viewType = [ pci.props.fgf0ViewList.dbValues[ 0 ] ];
            }
        } else {
            requestPref.viewType = [ '' ]; //pass view as empty string so that view is picked from the preference.
        }
    } else {
        requestPref.viewType = [ '' ]; //pass view as empty string so that view is picked from the preference.
    }

    var contextDataParams = appCtxService.getCtx( 'contextData' );
    if( contextDataParams ) {
        requestPref.componentID = [ contextDataParams.componentID ];
    }

    if( occContext && occContext.configContext ) {
        requestPref.useGlobalRevRule = occContext.configContext.useGlobalRevRule === true ? _TRUE : _FALSE;

        if( occContext.configContext.packSimilarElements !== undefined ) {
            requestPref.packSimilarElements = occContext.configContext.packSimilarElements === true ? _TRUE :
                _FALSE;
            // For pack/unpack use case we want updated PCI (index off) back from server
            // If it is already non-indexed product this does not matter,
            // but if it is indexed product used in non-index mode then we want to update our local storage with changed pci
            requestPref.useProductIndex = _FALSE;
        }
        if( occContext.configContext.isAppliedFromVCV ) {
            occContext.transientRequestPref.userGesture = [ 'VARIANT_RULE_CHANGE' ];
        }
    }

    if( currentContext.requestPref && !_.isEmpty( currentContext.requestPref.showMarkup ) ) {
        requestPref.useProductIndex = _FALSE;
    } else if( currentContext.isMarkupEnabled !== undefined ) {
        requestPref.showMarkup = currentContext.isMarkupEnabled === true ? _TRUE : _FALSE;
    }

    if( !_.isUndefined( currentContext.isChangeEnabled ) ) {
        requestPref.showChange = currentContext.isChangeEnabled === true ? _TRUE : _FALSE;
    } else if( !_.isUndefined( appCtxService.getCtx( 'showChange' ) ) ) {
        requestPref.showChange = appCtxService.getCtx( 'showChange' ) === true ? _TRUE : _FALSE;
    }

    var indexOffStr = localStorage.get( _LS_TOPIC_INDEX_OFF_LIST );

    if( indexOffStr ) {
        if( config && config.productContext && clientDataModelSvc.isValidObjectUid( config.productContext.uid ) ) {
            var indexOffProductList;
            indexOffProductList = JSON.parse( indexOffStr );
            requestPref.ignoreIndexForPCIs = indexOffProductList;
        } else {
            //Index off list is present in local storage but we are opening new object
            //Cleanup stale index off list from local storage and do not send it in request
            localStorage.removeItem( _LS_TOPIC_INDEX_OFF_LIST );
        }
    }


    if( currentContext.startFreshNavigation ) {
        requestPref.startFreshNavigation = currentContext.startFreshNavigation === true ? _TRUE :
            _FALSE;
    } else if( occContext && !_.isEmpty( occContext.configContext ) ) {
        requestPref.startFreshNavigation = occContext.configContext.startFreshNavigation === true ? _TRUE :
            _FALSE;
    } else if( !requestPref.startFreshNavigation ) {
        requestPref.startFreshNavigation = currentContext.startFreshNavigation === false ? _FALSE : _TRUE;
    }

    if( currentContext.recipe && currentContext.recipeOperator && currentContext.recipe.length > 0 ) {
        requestPref.filterCriteriaOperatorType = [ currentContext.recipeOperator ];
    }

    //set this req pref to true only if the subset panel is currently active, false otherwise.
    if( currentContext.subsetPanelEnabled === true ) {
        requestPref.populateFilters = _TRUE;
        requestPref.attributeCategoryPageSize = [ '100' ];
    }

    // Override the default requestPref value with transientRequestPref value.
    _.forEach( currentContext.transientRequestPref, function( value, name ) {
        if( !_.isUndefined( value ) ) {
            if( _.isArray( value ) ) {
                requestPref[ name ] = value;
            } else {
                requestPref[ name ] = [ value.toString() ];
            }
        }
    } );

    if( occContext ) {
        _.forEach( occContext.persistentRequestPref, function( value, name ) {
            if( !_.isUndefined( value ) ) {
                requestPref[ name ] = [ value.toString() ];
            }
        } );

        _.forEach( occContext.transientRequestPref, function( value, name ) {
            if( !_.isUndefined( value ) ) {
                if( _.isArray( value ) ) {
                    requestPref[ name ] = value;
                } else {
                    requestPref[ name ] = [ value.toString() ];
                }
            }
        } );

        // Reuse BOMWindow for the lightning feature in case of split mode
        if( requestPref.splitMode ) {
            if ( _.isEqual( requestPref.startFreshNavigation[ 0 ], 'true' ) ) {
                if( !_.isUndefined( requestPref.userGesture ) ) {
                    requestPref.createWindow = _TRUE;
                }
            }
            if( clientDataModelSvc.isValidObjectUid( config.productContext.uid ) &&
              !_.isUndefined( config.productContext.props ) &&
              !_.isUndefined( config.productContext.props.awb0FilterCount ) &&
              config.productContext.props.awb0FilterCount.dbValues[ 0 ] > 0 ) {
                requestPref.startFreshNavigation = _TRUE;
            }
        }
    }

    //Populate savedSessionMode as reset when opening snapshot
    if( !_.isNull( currentContext.currentState.snap_uid ) && !_.isUndefined( currentContext.currentState.snap_uid ) ) {
        requestPref.snapshot = [ currentContext.currentState.snap_uid ];
        requestPref.savedSessionMode = [ 'reset' ];
        requestPref.userGesture = [ 'APPLY_SNAPSHOT' ];
        requestPref.startFreshNavigation = _TRUE;
    }
};

export let populateRequestPrefParameters = function( requestPref, loadInput, currentContext, config, occContext ) {
    /** Calculate startFreshNavigation again with loadInput */
    var productOpenedInSplitViewUids = JSON.parse( sessionStorage.getItem( PRODUCTS_OPENED_IN_SPLITVIEW_UIDS ) );
    if( currentContext.startFreshNavigation ) {
        requestPref.startFreshNavigation = currentContext.startFreshNavigation === true ? _TRUE :
            _FALSE;
    } else if( occContext && !_.isEmpty( occContext.configContext ) ) {
        requestPref.startFreshNavigation = occContext.configContext.startFreshNavigation === true ? _TRUE :
            _FALSE;
    } else if( loadInput.openOrUrlRefreshCase === 'backButton' && !appCtxService.ctx.splitView &&
          productOpenedInSplitViewUids !== null && productOpenedInSplitViewUids.includes( currentContext.currentState.uid ) ) {
        requestPref.startFreshNavigation = _TRUE;
        sessionStorage.removeItem( PRODUCTS_OPENED_IN_SPLITVIEW_UIDS );
    } else if( ( loadInput.openOrUrlRefreshCase === 'open' || loadInput.openOrUrlRefreshCase === 'backButton' )
          && loadInput.isProductInteracted &&  appCtxService.ctx.swcCreatedObjectUid !== currentContext.currentState.uid
          && !isAppSessionType() && !isWorksetType() ) {
        requestPref.startFreshNavigation = _FALSE;
        appCtxService.updatePartialCtx( 'swcCreatedObjectUid', undefined );
    } /* else {
        requestPref.startFreshNavigation = currentContext.startFreshNavigation === false ? _FALSE : _TRUE;
    }*/

    populateRequestPrefParametersFromLoadInput( requestPref, loadInput );
    populateRequestPrefParametersFromContext( requestPref, currentContext, config, occContext );

    if( occContext ) {
        //If its open or url refresh case, don't send any state to server...let initial state come from server.
        if( _.isUndefined( loadInput.openOrUrlRefreshCase ) ) {
            if( !_.isEmpty( occContext.displayToggleOptions ) && _.isEqual( requestPref.startFreshNavigation[ 0 ], 'true' ) ) {
                _.forEach( occContext.displayToggleOptions, function( value, name ) {
                    requestPref[ name ] = [ value.toString() ];
                } );
            }
        }
    }
};

export let populateRequestPrefParametersForLocator = function( requestPref, loadInput, currentContext ) {
    requestPref.displayMode = [ loadInput.displayMode ];
    var sytemLocatorParams = appCtxService.getCtx( 'systemLocator' );
    requestPref.ProductId = [ currentContext.currentState.uid ];
    _.forEach( sytemLocatorParams, function( value, name ) {
        if( !_.isUndefined( value ) ) {
            requestPref[ name ] = [ value.toString() ];
        }
    } );

    appCtxService.unRegisterCtx( 'systemLocator' );
};

export default exports = {
    populateExpansionCriteriaParameters,
    populateExpansionCriteriaParameters2,
    populateRequestPrefParameters,
    populateRequestPrefParametersForLocator,
    populateRequestPrefParametersFromLoadInput,
    populateRequestPrefParametersFromContext
};


