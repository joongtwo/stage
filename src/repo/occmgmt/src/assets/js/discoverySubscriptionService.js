// Copyright (c) 2022 Siemens

/**
 * @module js/discoverySubscriptionService
 */
import appCtxSvc from 'js/appCtxService';
import aceConfiguratorTabsEvaluationService from 'js/aceConfiguratorTabsEvaluationService';
import aceFilterService from 'js/aceFilterService';
import cdmService from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import discoveryFilterService from 'js/discoveryFilterService';
import discoveryPropertyPolicyService from 'js/discoveryPropertyPolicyService';
import createWorksetService from 'js/createWorksetService';
import occmgmtUtils from 'js/occmgmtUtils';
import messageSvc from 'js/messagingService';
import localeSvc from 'js/localeService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import structureFilterService from 'js/structureFilterService';
import occmgmtGetSvc from 'js/occmgmtGetService';


var exports = {};
var _eventSubDefs = [];
var continueWithUnsaved = false;
var saveAsWorksetCloseListener;
var saveAsWorksetListener;
var _contextKey = null;
var _showingUserChoiceForWorksetSave;

/**
  * Initialize
  * @param {Object} continueWithoutSave set flag indicating continue without save usecase
*/
export let setContinueWithUnsaved = function( continueWithoutSave ) {
    continueWithUnsaved = continueWithoutSave;
};

export let initializeSaveAsReviseWorksetListeners = function() {
    saveAsWorksetListener = eventBus.subscribe( 'Awp0ShowSaveAs.saveAsComplete', function( data ) {
        // below publish event will add the newly created workset in interacted product list
        // so that getOcc SOA will get called with restore mode. This is needed so that the server
        // can create the autobookmark on getOcc call
        var createdObject = {
            uid: data.newObjectUid
        };
        var eventData = {
            createdObject: createdObject
        };
        eventBus.publish( 'swc.objectCreated', eventData );
        if ( continueWithUnsaved && appCtxSvc.ctx[_contextKey].worksetTopNode !== undefined &&
             appCtxSvc.ctx[_contextKey].worksetTopNode.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
            // continueWithUnSaved true reflects workset is dirty
            var localizedMessages = localeSvc.getLoadedText( 'OccurrenceManagementSubsetConstants' );

            if ( appCtxSvc.ctx[_contextKey].worksetTopNode.props.is_modifiable.dbValues[0] === '1' ) {
                messageSvc.showInfo( localizedMessages.saveAsWorksetWithPersistedChanges );
            } else{
                messageSvc.showInfo( localizedMessages.saveAsWorksetWithNoWriteAccess );
            }
        }
        continueWithUnsaved = false;
        if( appCtxSvc.ctx[_contextKey].saveAsOnConcurrentSave ) {
            delete appCtxSvc.ctx[_contextKey].saveAsOnConcurrentSave;
        }
        unsubscribeListenerWorkset();
    } );

    saveAsWorksetCloseListener = eventBus.subscribe( 'Awp0ShowSaveAs.contentUnloaded', function() {
        continueWithUnsaved = false;
        if( appCtxSvc.ctx[_contextKey].saveAsOnConcurrentSave ) {
            delete appCtxSvc.ctx[_contextKey].saveAsOnConcurrentSave;
        }
        unsubscribeListenerWorkset();
    } );
};

let unsubscribeListenerWorkset = function() {
    if( saveAsWorksetListener ) {
        eventBus.unsubscribe( saveAsWorksetListener );
    }
    if( saveAsWorksetCloseListener ) {
        eventBus.unsubscribe( saveAsWorksetCloseListener );
    }
};

let initializeContextKey = function( key ) {
    _contextKey = key;
};

/**
 * Evaluate the visibility of "Variant Conditions" tab
 * @param {Array} selectedObjs The selected objects collection
 * @param {Object} occContextValue Context passed to ACE sub-location
 * @returns {boolean} true if Variant Condition Authoring tab is visible and false otherwise
 */
let _evaluateVariantConditionsTabVisibility = function( selectedObjs, occContextValue ) {
    var enableVCA = false;
    if ( _.get( occContextValue, 'supportedFeatures.Awb0SupportsVariantConditionAuthoring' ) && !_.get( appCtxSvc, 'ctx.splitView.mode' ) ) {
        // Verify that the selected objects are valid and belong to the same product.
        var validSelections = occmgmtSubsetUtils.validateSelectionsToBeInSingleProduct( true );
        if( validSelections.length === selectedObjs.length ) {
            // Now call the ace service to verify that the selections are valid for VCA.
            enableVCA = aceConfiguratorTabsEvaluationService.evaluateVariantConditionsTabVisibilityOnSelection( selectedObjs, occContextValue );
        }
    }
    return enableVCA;
};

/**
 * Evaluate the visibility of "Variant Configuration" tab
 * @param {Object} selectedObjs An array of currently selected objects
 * @param {Object} occContextValue An updated version of subPanelContext objectprovided by the parent view
 * @returns {boolean} true if Variant Configuration tab is visible and false otherwise
 */
let _evaluateVariantConfigurationTabVisibility = function( selectedObjs, occContextValue ) {
    var enableVCV = false;
    if ( _.get( occContextValue, 'supportedFeatures.Awb0SupportsFullScreenVariantConfiguration' ) && !_.get( appCtxSvc, 'ctx.splitView.mode' ) ) {
        // Verify that the selected objects are valid and belong to the same product.
        var validSelections = occmgmtSubsetUtils.validateSelectionsToBeInSingleProduct( false );
        if( validSelections.length === selectedObjs.length ) {
            enableVCV = true;
        }
    }
    return enableVCV;
};

export let initialize = function( contextKey ) {
    // Register property policy overrides form discovery subtypes.
    discoveryPropertyPolicyService.registerPropertyPolicy();
    discoveryFilterService.setContextKey( contextKey );
    createWorksetService.setContextKey( contextKey );
    initializeContextKey( contextKey );

    _eventSubDefs.push( eventBus.subscribe( 'awConfigPanel.variantInfoChanged', function( ) {
        // Subscribe to variant rule change event. We need this handling due to VOO changes.
        // The AW server expected filterOrRecipeChange to be true when removing VOO via
        // "No Variant Rule" action in client. This is because although VOO is shown as a
        // variant rule in UI, it is actually a Recipe option and is bookmarked via Recipe.

        // Get the current PCI and check if the VOO feature is present in there. If it is then
        // we can conclude that user is trying to unset the VOO via SVR application.
        var aceActiveContext = appCtxSvc.getCtx( contextKey );
        if( aceActiveContext && aceActiveContext.supportedFeatures && aceActiveContext.supportedFeatures.Awb0ConfiguredByProximity ) {
            // Set filterOrRecipeChange preference as true now.
            let value = {
                transientRequestPref: {
                    filterOrRecipeChange: true
                }
            };
            occmgmtUtils.updateValueOnCtxOrState( '', value, contextKey );
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'appCtx.register', function( eventData ) {
        if( eventData.name === 'panelContext' && eventData.value !== undefined && eventData.value.SelectedObjects !== undefined &&
         eventData.value.SelectedObjects[0].modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1    ) {
            var worksetItem = appCtxSvc.ctx[_contextKey].worksetItemTopNode;
            if ( worksetItem && worksetItem.props && worksetItem.props.is_modifiable.dbValues[0] === '0' ||
                  appCtxSvc.ctx[_contextKey].saveAsOnConcurrentSave ) {
                appCtxSvc.updateCtx( 'panelContext.ReviseHidden', 'true' );
            } else {
                appCtxSvc.updateCtx( 'panelContext.ReviseHidden', 'false' );
            }
        }

        if( eventData.name === 'mselected' && appCtxSvc.ctx[contextKey]  ) {
            evaluateValidityOfSelections();
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'appCtx.update', function( data ) {
        if( data.target === 'isRestoreOptionApplicableForProduct' && appCtxSvc.ctx[contextKey].productContextInfo && appCtxSvc.ctx[contextKey].productContextInfo &&
         appCtxSvc.ctx[contextKey].productContextInfo.props.awb0Snapshot !== undefined && appCtxSvc.ctx[contextKey].productContextInfo.props.awb0Snapshot.dbValues[0] !== '' && !_.isNull( appCtxSvc.ctx[contextKey].productContextInfo.props.awb0Snapshot.dbValues[0] ) ) {
            occmgmtUtils.updateValueOnCtxOrState( 'isRestoreOptionApplicableForProduct', false, contextKey );
        }
        if( data.target === 'openedElement' ) {
            //LCS: 534110 :When workset is created, we want ctx to be populated with the modelTypeHierarchy of the opened
            // element. This code is written to have better control on the commandVisibility condition for all kind of worksets.
            //It is added at this place to maintain the lifecycle of the ctx variable throughout the user session.
            createWorksetService.updateCtxWithTopNodeHierarchy();
        }else if(  data.target === 'elementToPCIMap' ) {
            createWorksetService.updateCtxWithAppSessionWorksetNodeHierarchy();
        }

        if(  data.name === 'aceActiveContext' ) {
            evaluateValidityOfSelections();
        }
    } ) );

    // Subscribe to elementsAdded for addition of subset handling
    _eventSubDefs.push( eventBus.subscribe( 'addElement.elementsAdded', function( eventData ) {
        var updatedParentElement = eventData.updatedParentElement;
        var newElements = eventData.addElementResponse.selectedNewElementInfo.newElements;
        if( !updatedParentElement ) {
            updatedParentElement = eventData.addElementInput && eventData.addElementInput.parent ? eventData.addElementInput.parent : appCtxSvc.ctx[contextKey].addElement.parent;
        }
        if( newElements && newElements.length > 0 && createWorksetService.isWorkset( updatedParentElement ) ) {
            let soaInput = occmgmtGetSvc.getDefaultSoaInput();
            if ( newElements.length === 1 ) {
                soaInput.inputData.focusOccurrenceInput.element = occmgmtUtils.getObject( _.last( newElements ).uid );
            }

            let retainExpansionState = false;
            if( _.get( appCtxSvc, 'ctx.aceActiveContext.context.appSessionWorksetNode' ) ) {
                // Send startFreshNavigation to true when subset is added to Workset in Session - this will ensure Subset is selected after add
                soaInput.inputData.requestPref.startFreshNavigation = [ 'true' ];
                retainExpansionState = true;
            }
            eventBus.publish( 'aceLoadAndSelectProvidedObjectInTree', {
                objectsToSelect: newElements,
                viewToReact: _contextKey,
                parentToExpand: updatedParentElement.uid,
                updateVmosNContextOnPwaReset: true,
                getOccSoaInput: soaInput,
                retainExpansionState : retainExpansionState
            } );
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'ace.resetStructureStarted', function() {
        var aceActiveContext = appCtxSvc.getCtx( contextKey );
        if( discoveryFilterService.isDiscoveryIndexed() ||
        aceActiveContext && aceActiveContext.context && aceActiveContext.context.topElement.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1  ||
        createWorksetService.isWorkset( appCtxSvc.ctx.mselected[0] ) ) {
            discoveryFilterService.clearAllCacheOnReset();
            discoveryFilterService.setResetInitiated();
            // In case of reset, the view toggles on the client should not be sent anymore. The view toggles are read
            // from preference(product) or from structure context(session, workset) in aw server. Sending these viewtoggles
            // will override the view toggles read from preference or SC.
            // We are clearing these view toggles here since it is populated into the SOA input in
            // occmgmtRequestPrefPopulatorService if it is set on context.
            // TODO: Need discussion if the code
            // in request populator service needs to be changed to not populate this on reset since that change
            // will affect ACE index products too.
            occmgmtUtils.updateValueOnCtxOrState( 'showVariantsInOcc', undefined, contextKey );
            occmgmtUtils.updateValueOnCtxOrState( 'showInEffectiveOcc', undefined, contextKey );
            occmgmtUtils.updateValueOnCtxOrState( 'showSuppressedOcc', undefined, contextKey );
        }
    } ) );

    // Subscribe to productContextChangedEvent. This is fired after getOcc SOA is executed
    _eventSubDefs.push( eventBus.subscribe( 'productContextChangedEvent', function( eventData ) {
        if( eventData && eventData.dataProviderActionType &&
             ( eventData.dataProviderActionType === 'initializeAction' || eventData.dataProviderActionType === 'productChangedOnSelectionChange' ) ) {
            //Register custom function if in Workset OR if discoveryIndexed product
            var inWorksetContext = appCtxSvc.ctx[_contextKey].worksetTopNode !== undefined && appCtxSvc.ctx[_contextKey].worksetTopNode.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1;
            if ( inWorksetContext ) {
                occmgmtUtils.updateValueOnCtxOrState( 'populateFilterParamsFunc', populateFilterParamsFunc, contextKey );
            } else {
                if ( discoveryFilterService.isDiscoveryIndexed() ) {
                    occmgmtUtils.updateValueOnCtxOrState( 'populateFilterParamsFunc', populateFilterParamsFunc, contextKey );
                } else {
                    occmgmtUtils.updateValueOnCtxOrState( 'populateFilterParamsFunc', undefined, contextKey );
                }
            }
        }
    } ) );

    // Subscribe to event produced by ace framework to inform sub-modules in ace to provide an evaluation of visibility for configurator tabs (VCV/VCA)
    _eventSubDefs.push( eventBus.subscribe( 'ace.evaluateConfiguratorTabsVisibility', function( eventData ) {
        if ( eventData && eventData.selections && eventData.occContext && ( _.get( appCtxSvc, 'ctx.aceActiveContext.context.worksetTopNode' ) || _.get( appCtxSvc, 'ctx.aceActiveContext.context.appSessionWorksetNode' ) ) ) {
            let configuratorViewsDisplayContext = {
                showVariantConditionsView : _evaluateVariantConditionsTabVisibility( eventData.selections, eventData.occContext ),
                showVariantConfigurationView : _evaluateVariantConfigurationTabVisibility( eventData.selections, eventData.occContext )
            };
            appCtxSvc.updatePartialCtx( 'configuratorViewsDisplayContext', configuratorViewsDisplayContext );
        }
    } ) );
    // Subscribe to config change event.
    _eventSubDefs.push( eventBus.subscribe( 'configurationChangeStarted', function( ) {
        if( discoveryFilterService.isDiscoveryIndexed() ) {
            discoveryFilterService.clearAllCacheOnReset();
        }

        if( createWorksetService.isAutoSaveWorksetEnabled( _contextKey ) ) {
            registerPartialErrorOverride(  );
        }
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'workset.overridePartialErrorProcessing', function( ) {
        registerPartialErrorOverride();
    } ) );

    _eventSubDefs.push( eventBus.subscribe( 'submissionSuccessful', function( eventData ) {
        if( createWorksetService.isAutoSaveWorksetEnabled( _contextKey ) && eventData.createChangeData.pageId === 'Awp0NewWorkflowProcessWorkflowTab' ) {
            // Reload PWA now.
            let occContextValue = {
                pwaReset: true
            };
            occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, eventData.createChangeData.subPanelContext.occContext );
        }
    } ) );
};

var evaluateValidityOfSelections = function() {
    var validSelectedObjects = occmgmtSubsetUtils.validateSelectionsToBeInSingleProduct( true );
    discoveryFilterService.validateTermsToIncludeOrExclude( validSelectedObjects );
    var isInWorksetContext = appCtxSvc.ctx[_contextKey].worksetTopNode;
    var isInAppSessionWorksetContext = appCtxSvc.ctx[_contextKey].appSessionWorksetNode;
    if ( isInWorksetContext || isInAppSessionWorksetContext ) {
        if( validSelectedObjects && validSelectedObjects.length >= 1 && validSelectedObjects.length === appCtxSvc.ctx.mselected.length ) {
            occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsInSingleSubsetInWorkset', true, 'filter' );
        } else {
            occmgmtUtils.updateValueOnCtxOrState( 'validSelectionsInSingleSubsetInWorkset', false, 'filter' );
        }
    }
};

var registerPartialErrorOverride = function( ) {
    let context = appCtxSvc.getCtx( _contextKey );
    if( !context.processPartialErrorsFunc ) {
        occmgmtUtils.updateValueOnCtxOrState( 'processPartialErrorsFunc', processPartialErrorsFunc, _contextKey );
    }
};

var processPartialErrorsFunc = function( soaResponse ) {
    var isFurtherProcessingReq = true;
    // Look for our specific error code in partial error.
    if( soaResponse.ServiceData.partialErrors ) {
        _.forEach( soaResponse.ServiceData.partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( errorValue ) {
                if( errorValue.code === 126276 ) {
                    if( _showingUserChoiceForWorksetSave ) {
                        isFurtherProcessingReq = false;
                        return isFurtherProcessingReq;
                    }
                    _showingUserChoiceForWorksetSave = true;
                    var resource = 'OccurrenceManagementSubsetConstants';
                    var localTextBundle = localeSvc.getLoadedText( resource );
                    // Create buttons for concurrent save warning message.
                    var buttons = [ {
                        addClass: 'btn btn-notify',
                        text: localTextBundle.CancelText,
                        onClick: function( $noty ) {
                            _showingUserChoiceForWorksetSave = false;
                            $noty.close();
                            // Case: Cancel
                            eventBus.publish( 'ace.cancelUserChanges' );
                        }
                    },
                    {
                        addClass: 'btn btn-notify',
                        text: localTextBundle.OverwriteText,
                        onClick: function( $noty ) {
                            $noty.close();
                            _showingUserChoiceForWorksetSave = false;
                            // Case: Overwrite
                            eventBus.publish( 'ace.redoUserChanges' );
                        }
                    } ];

                    // display the pop-up dialog now with warning info.
                    messageSvc.showWarning( errorValue.message, buttons );
                    // Inform framework that we will take care of message display and do not need them
                    // to process it any further after we are done.
                    isFurtherProcessingReq = false;
                    return isFurtherProcessingReq;
                }
                return isFurtherProcessingReq;
            } );
        } );
    }
    return isFurtherProcessingReq;
};

export let cancelUserChanges = function( occContext ) {
    if( occContext && occContext.transientRequestPref && occContext.transientRequestPref.filterOrRecipeChange ) {
        eventBus.publish( 'awDiscovery.recipeUpdateFailOnConcurrentSave' );
    }

    let onPwaLoadComplete = occContext.onPwaLoadComplete ? occContext.onPwaLoadComplete : 0;
    let occContextValue = {
        configContext: {},
        disabledFeatures: [],
        transientRequestPref: {},
        onPwaLoadComplete: onPwaLoadComplete + 1,
        pwaReset: undefined
    };
    occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
};

export let redoUserChanges = function( occContext ) {
    let occContextValue = {};
    if(  occContext.transientRequestPref.filterOrRecipeChange ) {
        // Case: recipe update
        occContextValue = {
            transientRequestPref: {
                calculateFilters: true,
                retainTreeExpansionStates: true,
                filterOrRecipeChange: true,
                jitterFreePropLoad: true,
                overwrite: true
            },
            updatedRecipe: occContext.updatedRecipe,
            pwaReset: !occContext.pwaReset // resetting pwaReset value to trigger reset action
        };
    }else if( occContext.transientRequestPref.replayRecipe ) {
        // Case: replay
        occContextValue = {
            transientRequestPref: {
                replayRecipe: true,
                jitterFreePropLoad: true,
                currentSelections: occmgmtUtils.getSelectedObjectUids( occContext.selectedModelObjects ),
                overwrite: true
            },
            pwaReset: !occContext.pwaReset  // resetting pwaReset value to trigger reset action
        };
    }else if( occContext.configContext ) {
        // Case: configuration update
        occContextValue = {
            transientRequestPref: {
                overwrite: true,
                jitterFreePropLoad: true,
                userGesture: occContext.transientRequestPref.userGesture
            },
            pwaReset: !occContext.pwaReset
        };
    }
    occmgmtUtils.updateValueOnCtxOrState( '', occContextValue, occContext );
};


var populateFilterParamsFunc = function( filter, currentContext, occContext ) {
    filter.searchFilterCategories = [];
    filter.searchFilterMap = {};
    var recipe;

    //Populate recipe when recipe is modified via applying proximity or delete or operator change
    if( occContext.updatedRecipe ) {
        recipe = occContext.updatedRecipe;
        currentContext.requestPref.recipeUpdated =  [ 'true' ];
    }

    filter.fetchUpdatedFilters = false;
    filter.recipe = [];
    var criteriaTypeStr = currentContext.requestPref.criteriaType;

    if( criteriaTypeStr ) {
        var recipeInfo = {
            criteriaType: criteriaTypeStr
        };

        filter.recipe.push( recipeInfo );
    }

    if( recipe ) {
        filter.recipe.push.apply( filter.recipe, recipe );
    }

    filter.searchFilterFieldSortType = 'Priority';
    filter.searchSortCriteria = [];
};

export let populateFilterParameters = function( loadInput, inputFilterString, filter, currentContext, occContext ) {
    var filterString = null;
    let parentElement = loadInput.parentElement;
    if( inputFilterString !== undefined && inputFilterString !== null ) {
        filterString = inputFilterString;
    } else {
        var object =  cdmService.getObject( parentElement );
        if( object ) {
            var pciForSelection =  occmgmtUtils.getProductContextForProvidedObject( object );
            if( pciForSelection ) {
                var computedFilterString = structureFilterService.computeFilterStringForNewProductContextInfo( pciForSelection );
                filterString = computedFilterString;
            } else{
                filterString = occContext.currentState.filter;
            }
        }
    }
    filter.searchFilterCategories = [];
    filter.searchFilterMap = {};
    var recipe;

    // Populate filters/recipe only when filters are applied from this action OR when a filtered structure is being refreshed
    // or expanded
    if( occContext.appliedFilters || currentContext.appliedFilters ) {
        recipe = currentContext.recipe;
        var appliedFilters = occContext.appliedFilters ? occContext.appliedFilters : currentContext.appliedFilters;
        if( appliedFilters.filterCategories && appliedFilters.filterMap ) {
            filter.searchFilterCategories = appliedFilters.filterCategories;
            filter.searchFilterMap = appliedFilters.filterMap;
        }
    } else if( filterString && !currentContext.updatedRecipe  ) {
        var categoriesInfo = aceFilterService.extractFilterCategoriesAndFilterMap( filterString );
        filter.searchFilterCategories = categoriesInfo.filterCategories;
        filter.searchFilterMap = categoriesInfo.filterMap;
        recipe = currentContext.recipe;
        // Set calculateFilters to true as they are needed to initialize the filter panel
        // in case of ACE indexed product refresh
        if( loadInput.openOrUrlRefreshCase === 'urlRefresh' || loadInput.openOrUrlRefreshCase === 'backButton' ) {
            currentContext.requestPref.calculateFilters = true;
        }
    }

    // TODO: Change when 4G also updates atomic data for recipe
    //Populate recipe when recipe is modified via applying proximity or delete or operator change
    if( currentContext.updatedRecipe || occContext.updatedRecipe ) {
        recipe = currentContext.updatedRecipe;
        currentContext.requestPref.recipeUpdated =  [ 'true' ];
    }

    filter.fetchUpdatedFilters = false;
    filter.recipe = [];
    var criteriaTypeStr = currentContext.requestPref.criteriaType;

    if( criteriaTypeStr ) {
        var recipeInfo = {
            criteriaType: criteriaTypeStr
        };

        filter.recipe.push( recipeInfo );
    }

    if( recipe ) {
        filter.recipe.push.apply( filter.recipe, recipe );
    }

    filter.searchFilterFieldSortType = 'Priority';
    filter.searchSortCriteria = [];
};

/**
 * Destroy
 */
export let destroy = function() {
    _.forEach( _eventSubDefs, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );

    // Unregister property policy overrides on destroy.
    discoveryPropertyPolicyService.unRegisterPropertyPolicy();
};

export default exports = {
    initialize,
    populateFilterParameters,
    populateFilterParamsFunc,
    destroy,
    setContinueWithUnsaved,
    initializeSaveAsReviseWorksetListeners,
    redoUserChanges,
    cancelUserChanges
};

