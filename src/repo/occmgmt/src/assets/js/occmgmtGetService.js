// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtGetService
 */
import AwFilterService from 'js/awFilterService';
import soaSvc from 'soa/kernel/soaService';
import clientDataModelSvc from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import discoverySubscriptionSvc from 'js/discoverySubscriptionService';
import occmgmtGetOccsResponseService from 'js/occmgmtGetOccsResponseService';
import occmgmtRequestPrefPopulatorService from 'js/occmgmtRequestPrefPopulatorService';
import occmgmtTreeTableStateService from 'js/occmgmtTreeTableStateService';
import dateTimeService from 'js/dateTimeService';
import _ from 'lodash';
import occmgmtUtils from 'js/occmgmtUtils';
import structureFilterService from 'js/structureFilterService';

var _convertDate = function( dateInEpochFormat ) {
    if( !dateInEpochFormat || dateInEpochFormat < 0 ) {
        return dateTimeService.NULLDATE;
    }
    return AwFilterService.instance( 'date' )( dateInEpochFormat, 'yyyy-MM-dd' ) + 'T' +
        AwFilterService.instance( 'date' )( dateInEpochFormat, 'HH:mm:ssZ' );
};

var _populateFocusOccurrenceInputParameters = function( inputData, occContext ) {
    /**
     * Check if the 'focus' has not been set yet.
     */
    if( _.isEmpty( inputData.focusOccurrenceInput ) ) {
        if( occContext.currentState.c_csid ) {
            inputData.focusOccurrenceInput.cloneStableIdChain = occContext.currentState.c_csid;
        } else {
            if( //
                clientDataModelSvc.isValidObjectUid( occContext.currentState.c_uid ) && //
                clientDataModelSvc.isValidObjectUid( occContext.currentState.o_uid ) && //
                clientDataModelSvc.isValidObjectUid( inputData.parentElement ) && //
                occContext.currentState.c_uid !== occContext.currentState.o_uid && //
                occContext.currentState.c_uid !== occContext.currentState.t_uid ) {
                /**
                 * Note: We only want to set a 'focus' when we have all the correct 'parent' information.
                 */
                inputData.focusOccurrenceInput.element = occmgmtUtils.getObject( occContext.currentState.c_uid );
            }
        }
    }
};

var _populateCursorParameters = function( cursor, loadInput ) {
    if( loadInput.cursorObject ) {
        _.assign( cursor, loadInput.cursorObject );
    } else if( loadInput.parentNode && loadInput.parentNode.cursorObject ) {
        _.assign( cursor, loadInput.parentNode.cursorObject );
    } else {
        /**
         * Going forward, we need need to use cursor information here if it is a scroll case.
         * <P>
         * If we use cursor, it will bring next set of children.
         * <P>
         * For normal expand (expand collapse expand use case), where user expects to see first page again, doing
         * scroll there doesn't make sense. We need information from CFX where it is scroll case or expand case
         */
        cursor.startReached = false;
        cursor.endReached = false;
        cursor.startIndex = loadInput.startChildNdx;
        cursor.endIndex = 0;
        cursor.pageSize = loadInput.pageSize;
        // We can not pass clientDataModelSvc.NULL_UID in startOccUid and endOccUid for following reason
        // 1. These are not uid they are pfuid from RTT_BOMLINE. specialized RM DFS mechanism for doing pagination.
        // 2. platform Requirement Management does not check for NULL_UID. They check for empty string ("")
        // 3. RM is implementing null uid check in server occmgmt layer to translate NULL_UID to "". Till they are done we need to continue passing empty string
        // 4. As of now passing NULL_UID causes server hang in flat navigation use-cases for 11.3 and above.
        cursor.startOccUid = '';
        cursor.endOccUid = '';
    }
};

// eslint-disable-next-line complexity
var _populateConfigurationParameters = function( config, currentContext, occContext ) {
    if( !config.productContext || !config.productContext.uid || config.productContext.uid === clientDataModelSvc.NULL_UID ) {
        config.productContext = occmgmtUtils.getObject( occContext.currentState.pci_uid );
    }

    var pci;

    if( occContext && !_.isEmpty( occContext.configContext ) ) {
        var configContext = occContext.configContext;

        if( !_.isEmpty( configContext ) && !occContext.skipReloadOnConfigParamChange ) {
            config.endItem = occmgmtUtils.getObject( configContext.ei_uid );
            config.revisionRule = occmgmtUtils.getObject( configContext.r_uid );
            if( configContext.rev_sruid ) {
                config.serializedRevRule = configContext.rev_sruid;
            } else if( config.revisionRule.serializedRevRule ) {
                config.serializedRevRule = config.revisionRule.serializedRevRule;
            } else if( currentContext.serializedRevRule && config.productContext && _.isEqual( config.productContext.props.awb0CurrentRevRule.dbValues[0], configContext.r_uid ) ) {
                var swc = false;
                if( config.productContext.props.awb0ContextObject && config.productContext.props.awb0ContextObject.dbValues ) {
                    swc = clientDataModelSvc.getObject( config.productContext.props.awb0ContextObject.dbValues[ 0 ] );
                }
                if( !swc ) {
                    config.serializedRevRule = currentContext.serializedRevRule;
                }
            }

            config.svrOwningProduct = occmgmtUtils.getObject( configContext.iro_uid );

            if( clientDataModelSvc.isValidObjectUid( configContext.var_uid ) ) {
                config.variantRules = [ occmgmtUtils.getObject( configContext.var_uid ) ];
            }

            if( configContext.var_uids ) {
                config.variantRules = [];
                for( var i = 0; i < configContext.var_uids.length; i++ ) {
                    if( clientDataModelSvc.isValidObjectUid( configContext.var_uids[ i ] ) ) {
                        config.variantRules[ i ] = occmgmtUtils.getObject( configContext.var_uids[ i ] );
                    }
                }
            }

            // Add effectivityGroups
            if( configContext.eg_uids ) {
                config.effectivityGroups = [];
                for( var i = 0; i < configContext.eg_uids.length; i++ ) {
                    if( clientDataModelSvc.isValidObjectUid( configContext.eg_uids[ i ] ) ) {
                        config.effectivityGroups[ i ] = occmgmtUtils.getObject( configContext.eg_uids[ i ] );
                    }
                }
            }

            // Add Closure Rules
            if( configContext.cl_uid ) {
                if( clientDataModelSvc.isValidObjectUid( configContext.cl_uid ) ) {
                    config.closureRule = occmgmtUtils.getObject( configContext.cl_uid );
                }
            } else if( clientDataModelSvc.isValidObjectUid( occContext.currentState.pci_uid ) ) {
                pci = occmgmtUtils.getObject( occContext.currentState.pci_uid );
                if( pci && pci.props && pci.props.awb0ClosureRule ) {
                    var closureRuleUid = pci.props.awb0ClosureRule.dbValues[ 0 ];
                    if( clientDataModelSvc.isValidObjectUid( closureRuleUid ) ) {
                        config.closureRule = occmgmtUtils.getObject( closureRuleUid );
                    }
                }
            }

            // Add applied arrangement
            if( configContext.ar_uid ) {
                config.appliedArrangement = occmgmtUtils.getObject( configContext.ar_uid );
            }
            // Add View Types
            if( configContext.vt_uid ) {
                config.viewType = occmgmtUtils.getObject( configContext.vt_uid );
            }

            if( clientDataModelSvc.isValidObjectUid( configContext.org_uid ) ) {
                config.occurrenceScheme = occmgmtUtils.getObject( configContext.org_uid );
            } else if( clientDataModelSvc.isValidObjectUid( occContext.currentState.pci_uid ) ) {
                pci = occmgmtUtils.getObject( occContext.currentState.pci_uid );

                if( pci.props.fgf0PartitionScheme ) {
                    config.occurrenceScheme = pci.props.fgf0PartitionScheme;
                }
            }

            if( clientDataModelSvc.isValidObjectUid( configContext.baselinerev_uid ) ) {
                config.sourceContext = occmgmtUtils.getObject( configContext.baselinerev_uid );
            }

            if( configContext.de ) {
                config.effectivityDate = _convertDate( configContext.de );
            }

            config.unitNo = configContext.ue ? parseInt( configContext.ue ) : -1;

            var startDate = configContext.startDate;
            var fromUnit = configContext.fromUnit;
            var intentFormula = configContext.intentFormula;

            if( startDate || fromUnit || intentFormula ) {
                config.effectivityRanges = [];

                var effectivityRange = {};

                effectivityRange.dateIn = startDate;
                effectivityRange.dateOut = configContext.endDate;
                effectivityRange.unitIn = isNaN( fromUnit ) ? -1 : parseInt( fromUnit );
                effectivityRange.unitOut = isNaN( configContext.toUnit ) ? -1 : parseInt( configContext.toUnit );
                if( !_.isUndefined( intentFormula ) ) { //user has explicity applied the intent
                    effectivityRange.intentFormula = configContext.intentFormula;
                } else if( clientDataModelSvc.isValidObjectUid( occContext.currentState
                    .pci_uid ) ) { //Intent is already applied and then user is changing the other configuration then pass the already applied intent
                    pci = occmgmtUtils.getObject( occContext.currentState.pci_uid );
                    if( pci && !_.isEmpty( pci ) && pci.props && pci.props.fgf0IntentFormulaList ) { //Needed this check for refresh scenario
                        effectivityRange.intentFormula = pci.props.fgf0IntentFormulaList.dbValues[ 0 ];
                    } else {
                        effectivityRange.intentFormula = '';
                    }
                } else {
                    effectivityRange.intentFormula = '';
                }

                config.effectivityRanges[ 0 ] = effectivityRange;
            }
        }
    }

    // Change context modified in configuration panel
    var changeContext;
    if( appCtxService.ctx.changeContext ) {
        changeContext = appCtxService.ctx.changeContext;
        if( clientDataModelSvc.isValidObjectUid( changeContext.uid ) ) {
            config.changeContext = changeContext;
        }
    } else {
        // Retain change context when other config parameters changed
        if( clientDataModelSvc.isValidObjectUid( occContext.currentState.pci_uid ) ) {
            pci = occmgmtUtils.getObject( occContext.currentState.pci_uid );
        } else if( currentContext.productContextInfo ) {
            pci = occmgmtUtils.getObject( currentContext.productContextInfo.uid );
        }
        if( pci && !_.isEmpty( pci ) && pci.props && pci.props.fgf0ChangeContext ) {
            config.changeContext = occmgmtUtils.getObject( pci.props.fgf0ChangeContext.dbValues[ 0 ] );
        }
    }
    // populate ProductContext for snapshot
    if( currentContext.currentState.snap_uid && currentContext.productContextInfo ) {
        config.productContext = currentContext.productContextInfo;
    }
};

var _populateSortCriteriaParameters = function( sortCriteria, loadInput ) {
    if( !_.isEmpty( loadInput.sortCriteria ) ) {
        sortCriteria.propertyName = loadInput.sortCriteria[ 0 ].fieldName;
        sortCriteria.sortingOrder = loadInput.sortCriteria[ 0 ].sortDirection;
    }
};

var _populateParametersForGetOccurrences =  function( loadInput, soaInput, currentContext, occContext ) {
    var inputData = soaInput.inputData;
    inputData.product = occmgmtUtils.getObject( loadInput.loadIDs.uid );

    inputData.parentElement = loadInput.parentElement;

    _populateConfigurationParameters( inputData.config, currentContext, occContext );

    if( inputData.config.productContext.uid === clientDataModelSvc.NULL_UID && loadInput.productContext ) {
        inputData.config.productContext = loadInput.productContext;
    }
    _populateCursorParameters( inputData.cursor, loadInput );

    if( !loadInput.skipFocusOccurrenceCheck ) {
        _populateFocusOccurrenceInputParameters( inputData, occContext );
        if( inputData.focusOccurrenceInput.element === undefined && loadInput.focusInput !== null ) {
            inputData.focusOccurrenceInput.element = occmgmtUtils.getObject( loadInput.focusInput );
        }
    }

    // There are cases where we want to use filter parameters other than the one in the URL. In such cases the filter string is sent
    // in the input.
    if ( currentContext.populateFilterParamsFunc ) {
        currentContext.populateFilterParamsFunc( inputData.filter, currentContext, occContext );
    } else {
        discoverySubscriptionSvc.populateFilterParameters( loadInput, loadInput.filterString, inputData.filter, currentContext, occContext );
    }
    occmgmtRequestPrefPopulatorService.populateRequestPrefParameters( inputData.requestPref, loadInput,
        currentContext, inputData.config, occContext );
    occmgmtRequestPrefPopulatorService.populateExpansionCriteriaParameters( inputData.expansionCriteria, occContext );
    _populateSortCriteriaParameters( inputData.sortCriteria, loadInput );
};

var exports = {};

/**
 * @param {TreeLoadInput | ListLoadInput} loadInput - Object containing specific loading parameters and options.
 * @param {OccurrencesData} soaInput - Input structure to getOccurrences() SOA.
 * @param {ContextState} contextState - Context State
 * @returns {OccurrencesResponse} - Response from getOccurrences() SOA.
 */
export let getOccurrences = function( loadInput, soaInput, contextState ) {
    var inputData = soaInput.inputData;

    let occContext = contextState.occContext;
    let currentContext = appCtxService.getCtx( occContext.viewKey );

    if ( appCtxService.getCtx( 'systemLocator' ) ) {
        occmgmtRequestPrefPopulatorService.populateRequestPrefParametersForLocator( inputData.requestPref,
            loadInput, currentContext );
    } else {
        _populateParametersForGetOccurrences( loadInput, soaInput, currentContext, occContext );
    }

    if( currentContext ) {
        currentContext.getOccInput = soaInput;
        currentContext.transientRequestPref = {};
        appCtxService.updatePartialCtx( occContext.viewKey, currentContext );
    }
    return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4',
        soaInput ).then( function( response ) {
        var deferred = AwPromiseService.instance.defer();
        if( response.requestPref && response.requestPref.deltaTreeResponse &&
            response.requestPref.deltaTreeResponse[0].toLowerCase() === 'true' ) {
            // When delta response comes into picture and
            // there is no change in the structure, getTableViewModelProperties is not called and
            // treeLoadingInProgress is not reset to false value. Because of which selection on pwa
            // is do not happen. Hence, explicitly setting treeLoadingInProgress to false here.
            if( !_.isEmpty( response.parentChildrenInfos ) &&
            _.isEmpty( response.parentChildrenInfos[0].childrenInfo ) ) {
                appCtxService.updatePartialCtx( occContext.viewKey + '.treeLoadingInProgress', false );
            }

            // We are here, because server has sent delta response.
            // It is expected to merge the tree with this delta response.
            // So rebuild parent children info using existing tree and delta responsing and then
            // process response.
            occmgmtGetOccsResponseService.convertDeltaResponseToFullResponse( response, occContext, loadInput.focusObjectHierarchy );
        }

        if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
            // This variable informs the ACE framework whether a sub-ACE application would like to let the framework proceed with its default
            // implementation. This is particularly helpful in cases where some applications may want to entirely avoid framework's default
            // behavior and override it with there own, where as also giving some applications the freedom to perform some action of their own


            if( currentContext.processPartialErrorsFunc ) {
                var shouldFrameworkProcessResponse = true;
                shouldFrameworkProcessResponse = currentContext.processPartialErrorsFunc( response );
                if( !shouldFrameworkProcessResponse ) {
                    deferred.reject();
                    return deferred.promise;
                }
            }
            occmgmtGetOccsResponseService.processPartialErrors( response );
        }
        deferred.resolve( response );
        return deferred.promise;
    }, function( error ) {
        occmgmtGetOccsResponseService.processFailedIndexError( error );
        throw soaSvc.createError( error );
    } );
};

/**
 * @returns {OccurrencesData} Input structure to getOccurrences() SOA with default values.
 */
export let getDefaultSoaInput = function() {
    return {
        inputData: {
            config: {
                effectivityDate: '0001-01-01T00:00:00',
                unitNo: -1
            },
            cursor: {},
            focusOccurrenceInput: {},
            filter: {},
            requestPref: {},
            expansionCriteria: {
                expandBelow: false,
                levelNExpand: 0,
                loadTreeHierarchyThreshold: 0,
                scopeForExpandBelow: ''
            },
            sortCriteria: {}
        }
    };
};

const nullObject = { uid:'AAAAAAAAAAAAAA', type:'unknownType' };
const getOccurrences4SoaInput = { inputData:
    { config:
        { effectivityDate:'0001-01-01T00:00:00', unitNo:-1,
            productContext:{ uid:'', type:'' },
            revisionRule:nullObject,
            occurrenceScheme:nullObject,
            sourceContext: nullObject,
            changeContext: nullObject,
            appliedArrangement: nullObject,
            closureRule: nullObject,
            viewType: nullObject,
            serializedRevRule:'',
            effectivityGroups:[], endItem:nullObject, variantRules:[],
            svrOwningProduct:nullObject, effectivityRanges:[] },
    cursor:
        { startReached:false, endReached:false, startIndex:0, endIndex:0, pageSize:500, startOccUid:'', endOccUid:'', cursorData:[] },
    filter:
        { recipe:[], searchFilterCategories:[], searchFilterMap:{}, searchSortCriteria:[], searchFilterFieldSortType:'', fetchUpdatedFilters:false },
    requestPref:
        { displayMode:[ 'Tree' ],
            showExplodedLines:[ 'false' ],
            viewType:[ '' ],
            useGlobalRevRule:[ 'false' ],
            showMarkup:[ 'false' ],
            startFreshNavigation:[ 'false' ],
            defaultClientScopeUri:[ 'Awb0OccurrenceManagement' ] },
    expansionCriteria:
        { expandBelow:false, levelNExpand:1, loadTreeHierarchyThreshold:500, scopeForExpandBelow:'' },
    sortCriteria:
        { propertyName:'', sortingOrder:'' },
    product:nullObject,
    parentElement:'',
    focusOccurrenceInput:
        { element:nullObject, cloneStableIdChain:'' }
    } };

/**
 * Hacky
 * @param {ViewModelObject} vmo vmo
 * @param {Object} occContext occContext
 * @param {Object} expansionContext optional expansionContext
 * @returns {SoaInput} soaInput
 */
export let getExpandBelowSoaInput = function( vmo, occContext, expansionContext ) {
    var soaInput = getOccurrences4SoaInput;
    var inputData = soaInput.inputData;
    let currentContext = appCtxService.getCtx( occContext.viewKey );

    let product = occmgmtUtils.getObject( occContext.currentState.uid );
    inputData.product = product; //{ uid: product.uid, type: product.type };
    inputData.parentElement = vmo.id;

    // If we aren't supplying any focusOccurrenceInput, we must delete the key or SOA throws an exception
    delete inputData.focusOccurrenceInput;

    //_populateCursorParameters( inputData.cursor, {} );
    _populateConfigurationParameters( inputData.config, currentContext, occContext );

    //populateRequestPrefParametersFromContext
    occmgmtRequestPrefPopulatorService.populateRequestPrefParametersFromContext( inputData.requestPref,
        currentContext, inputData.config, occContext );
    if ( expansionContext ) {
        occmgmtRequestPrefPopulatorService.populateExpansionCriteriaParameters2( inputData.expansionCriteria, expansionContext );
    }
    _populateSortCriteriaParameters( inputData.sortCriteria, currentContext );

    // TODO: Remove this setting from occmgmtRequestPrefPopulatorService.populateRequestPrefParametersFromContext
    // We always want to start fresh navigation for our calls
    inputData.expansionCriteria.expandBelow = true;
    inputData.expansionCriteria.levelNExpand = -1;
    inputData.requestPref.useCursor = [ 'true' ];

    return soaInput;
};

/**
 * In case of Saved Working Context in Tree view it can happen so that filter is applied to multiple products.<br>
 * The URL will have filter information only for the active product.<br>
 * If a non-active product is being expanded we check if its information is available in the cache and use it
 */
function updateFilterParamsOnInputForCurrentPciUid( currentPciUid, contextState ) {
    if( !contextState.context.requestPref.calculateFilters ) {
        return structureFilterService
            .computeFilterStringForNewProductContextInfo( currentPciUid );
    }
    return null;
}

/**
 * Hacky
 * @param {ViewModelObject} parentNode parentNode VMO/VMTN
 * @param {Object} occContext occContext
 * @param {Object} expansionContext optional expansionContext
 * @returns {SoaInput} soaInput
 */
export let getExpandOneSoaInput = function( parentNode, occContext, expansionContext ) {
    var soaInput = getOccurrences4SoaInput;
    var inputData = soaInput.inputData;
    let currentContext = appCtxService.getCtx( occContext.viewKey );

    //let product = occmgmtUtils.getObject( occContext.currentState.uid );
    //inputData.product = { uid: product.uid, type: product.type };
    inputData.product = occmgmtUtils.getObject( occContext.currentState.uid );
    inputData.parentElement = parentNode.id;

    //if( inputData.config.productContext.uid === clientDataModelSvc.NULL_UID && loadInput.productContext ) {
    //    inputData.config.productContext = loadInput.productContext;
    //}
    //_populateStartingCursor( inputData.cursor, 0, 500 );

    // Not sure that productContext is correct yet. It's being set both inside populateConfigurationParameters,
    // and in the block below (from pci_uid). And possibly other places. It's pretty important, but what is the
    // correct flow?
    _populateConfigurationParameters( inputData.config, currentContext, occContext );

    // There are cases where we want to use filter parameters other than the one in the URL. In such cases the filter string is sent
    // in the input.
    if ( currentContext.populateFilterParamsFunc ) {
        currentContext.populateFilterParamsFunc( inputData.filter, currentContext, occContext );
    } else {
        let pci_uid = undefined;
        if( currentContext.elementToPCIMap ) {
            if( parentNode.pciUid ) {
                pci_uid = parentNode.pciUid;
            } else {
                pci_uid = occmgmtUtils.getProductContextForProvidedObject( parentNode );
            }
        }
        if( pci_uid ) {
            soaInput.inputData.config.productContext = occmgmtUtils.getObject( pci_uid );
            let filterString = undefined;
            if( pci_uid !== occContext.currentState.pci_uid ) {
                filterString = updateFilterParamsOnInputForCurrentPciUid( pci_uid, currentContext );
            }
            discoverySubscriptionSvc.populateFilterParameters( inputData, filterString, inputData.filter, currentContext, occContext );
        }
    }

    occmgmtRequestPrefPopulatorService.populateRequestPrefParametersFromContext( inputData.requestPref,
        currentContext, inputData.config, occContext );
    if ( expansionContext ) {
        occmgmtRequestPrefPopulatorService.populateExpansionCriteriaParameters2( inputData.expansionCriteria, expansionContext );
    }
    _populateSortCriteriaParameters( inputData.sortCriteria, currentContext );

    // TODO: Remove this setting from occmgmtRequestPrefPopulatorService.populateRequestPrefParametersFromContext
    // We always want to start fresh navigation for our calls
    inputData.requestPref.startFreshNavigation = [ 'true' ];
    inputData.expansionCriteria.expandBelow = false;
    inputData.expansionCriteria.levelNExpand = 1;

    return soaInput;
};

/**
 * Hacky
 * @param {Object} occContext occContext including { viewKey, currentState.uid, vmc, etc }
 * @param {Object} expansionContext optional expansionContext with { scopeForExpandBelow, levelsToExpand, }
 * @returns {SoaInput} soaInput
 */
export let getReconfigureWindowSoaInput = function( occContext, expansionContext ) {
    var soaInput = getOccurrences4SoaInput;
    var inputData = soaInput.inputData;
    let currentContext = appCtxService.getCtx( occContext.viewKey );

    let product = occmgmtUtils.getObject( occContext.currentState.uid );
    inputData.product = product; //{ uid: product.uid, type: product.type };
    inputData.parentElement = occContext.vmc.loadedVMObjects[0].id;

    // If we aren't supplying any focusOccurrenceInput, we must delete the key or SOA throws an exception
    delete inputData.focusOccurrenceInput;

    // When changing configuration we need to send list of expanded nodes to server
    //should this have generic check for retainTreeExpansionStates?
    // I can't find a way to get hold of the uwDataProvider so mock up a structure here
    // to satisfy needs of getCSIDChainsForExpandedNodes
    let dummyDataProvider = {
        viewModelCollection: occContext.vmc
    };
    soaInput.inputData.requestPref.expandedNodes = occmgmtTreeTableStateService.getCSIDChainsForExpandedNodes( dummyDataProvider );

    //_populateCursorParameters( inputData.cursor, {} );
    _populateConfigurationParameters( inputData.config, currentContext, occContext );

    occmgmtRequestPrefPopulatorService.populateRequestPrefParametersFromContext( inputData.requestPref,
        currentContext, inputData.config, occContext );
    if ( expansionContext ) {
        occmgmtRequestPrefPopulatorService.populateExpansionCriteriaParameters2( inputData.expansionCriteria, expansionContext );
    }
    _populateSortCriteriaParameters( inputData.sortCriteria, currentContext );

    // TODO: Remove this setting from occmgmtRequestPrefPopulatorService.populateRequestPrefParametersFromContext
    // We always want to start fresh navigation for our calls
    inputData.requestPref.startFreshNavigation = [ 'true' ];
    inputData.expansionCriteria.expandBelow = true;
    inputData.expansionCriteria.levelNExpand = -1;
    //inputData.requestPref.firstLevelOnly = [ 'false' ];

    return soaInput;
};

export default exports = {
    getOccurrences,
    getDefaultSoaInput,
    getExpandBelowSoaInput,
    getExpandOneSoaInput,
    getReconfigureWindowSoaInput
};
