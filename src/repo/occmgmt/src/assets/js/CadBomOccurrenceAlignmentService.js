// Copyright (c) 2022 Siemens

/**
 * @module js/CadBomOccurrenceAlignmentService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import LocationNavigationService from 'js/locationNavigation.service';
import cdmSvc from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import dataManagementService from 'soa/dataManagementService';
import CadBomOccAlignmentCheckService from 'js/CadBomOccAlignmentCheckService';
import messagingService from 'js/messagingService';
import _ from 'lodash';
import CBAImpactAnalysisService from 'js/CBAImpactAnalysisService';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import cbaRelatedObjectService from 'js/cbaRelatedObjectService';
import cbaOpenInViewPanelService from 'js/cbaOpenInViewPanelService';
import cbaObjectTypeService from 'js/cbaObjectTypeService';
import cbaConstants from 'js/cbaConstants';
import occmgmtUtils from 'js/occmgmtUtils';
import occmgmtBackingObjectProviderService from 'js/occmgmtBackingObjectProviderService';
import soaService from 'soa/kernel/soaService';

/**
 * Initialize the services for CBA
 */
export let initializeServiceForCBA = function() {
    CadBomOccurrenceAlignmentUtil.registerSplitViewMode();

    CadBomOccAlignmentCheckService.initializeService();
};

/**
 * Update header title and task title in context
 * @param {object} localTextBundle Localized text bundle
 */
let _updateTaskUIHeaderText = function( localTextBundle ) {
    appCtxSvc.updatePartialCtx( 'taskUI', {
        moduleTitle: localTextBundle.Awb0EntCBAModuleTitle,
        taskTitle: localTextBundle.Awb0EntCBAAlignTaskTitle
    } );
};

/**
 * Updates cba context
 *
 * @param {Object} cbaContext - cbaContext atomic data
 * @param {Object} value - value to update in context
 * @returns {Object} context with updated values
 */
let updateCbaContextData = function( cbaContext, value ) {
    var newCbaContext = { ...cbaContext };
    for( const key of Object.keys( value ) ) {
        newCbaContext[ key ] = value[ key ];
    }
    return { ...newCbaContext };
};

/**
 * Load CBA data before page launch
 *
 * @param {Object} cbaContext - cbaContext atomic data
 * @returns {Promise} Promise after data load is done
 */
export let loadCBAData = function( cbaContext, eventData ) {
    let defer = AwPromiseService.instance.defer();

    let resource = 'CadBomAlignmentConstants';
    let localTextBundle = localeService.getLoadedText( resource );
    if( localTextBundle ) {
        _updateTaskUIHeaderText( localTextBundle );
    } else {
        localeService.getTextPromise( resource ).then( function( localTextBundle ) {
            _updateTaskUIHeaderText( localTextBundle );
        } );
    }

    appCtxSvc.ctx.skipAutoBookmark = true;
    // CBA don't need to show the Right Wall.
    appCtxSvc.ctx.hideRightWall = true;
    let toParams;
    let mSelected = appCtxSvc.getCtx( 'mselected' );

    if( mSelected && mSelected.length !== 0 && mSelected[ 0 ] && mSelected[ 0 ].type === 'Fnd0Message' ) {
        toParams = CadBomAlignmentUtil.getURLParametersFromDataset( mSelected[ 0 ] );
    } else {
        toParams = appCtxSvc.getCtx( 'state.params' );
    }
    let uidForLoadObject = [];
    if( eventData && eventData.urlParams ) {
        toParams = eventData.urlParams.urlParams;
    }
    if( toParams.uid ) {
        uidForLoadObject.push( toParams.uid );
    }

    if( toParams.uid2 ) {
        uidForLoadObject.push( toParams.uid2 );
    }

    let objectCount = uidForLoadObject.length;
    if( toParams.spci_uid ) {
        uidForLoadObject.push( toParams.spci_uid );
    }

    if( toParams.tpci_uid ) {
        uidForLoadObject.push( toParams.tpci_uid );
    }

    if( toParams.adaptObj_uid ) {
        uidForLoadObject.push( toParams.adaptObj_uid );
    }

    if( toParams.ecn_uid ) {
        uidForLoadObject.push( toParams.ecn_uid );
    }

    dataManagementService.loadObjects( uidForLoadObject ).then( function() {
        let result = {};
        result.data = [];
        let valueToUpdate = {
            isCBAFirstLaunch: true,
            isImpactAnalysisMode: false
        };
        for( let i = 0; i < objectCount; i++ ) {
            let modelObject = cdmSvc.getObject( uidForLoadObject[ i ] );
            result.data.push( modelObject );
        }
        if( toParams.isIA_mode ) {
            valueToUpdate = {
                isCBAFirstLaunch: true,
                isImpactAnalysisMode: true,
                ImpactAnalysis: {
                    sourceTopItem: cdmSvc.getObject( toParams.adaptObj_uid ),
                    alignedTargetProviderInECN: 'Pma1AlignedTargetProvider',
                    ECNForImpactAnalysis: cdmSvc.getObject( toParams.ecn_uid )
                }
            };
        }

        if( objectCount === 2 ) {
            valueToUpdate.srcStructure = result.data[ 0 ];
            valueToUpdate.trgStructure = result.data[ 1 ];
        } else if( toParams.uid ) {
            valueToUpdate.srcStructure = result.data[ 0 ];
            valueToUpdate.trgStructure = null;
        } else if( toParams.uid2 ) {
            valueToUpdate.trgStructure = result.data[ 0 ];
            valueToUpdate.srcStructure = null;
        }
        let newContext = updateCbaContextData( cbaContext, valueToUpdate );
        occmgmtUtils.updateValueOnCtxOrState( '', valueToUpdate, cbaContext );
        //Update the source and target structure on ctx.cbaContext
        occmgmtUtils.updateValueOnCtxOrState( 'srcStructure', valueToUpdate.srcStructure, 'cbaContext' );
        occmgmtUtils.updateValueOnCtxOrState( 'trgStructure', valueToUpdate.trgStructure, 'cbaContext' );
        newContext.modelObjectsToOpen = result.data;
        defer.resolve( newContext );
    } );
    return defer.promise;
};

/**
 * Get valid aligned or linked object for CBA
 * @param {Object} relatedObjectsMapping - Related model objects with respective first object
 * @return {Object} - If firstObject is Part then return it's Primary Design
 *                    if firstObject is Design/Product then return it's related object if that is the only aligned/linked object to the selected Design/Product
 */
let _getValidAlignedOrLinkedObjectForCBA = function( relatedObjectsMapping ) {
    let deferred = AwPromiseService.instance.defer();

    let firstObject = relatedObjectsMapping.firstObject;

    cbaObjectTypeService.getDesignsAndParts( [ firstObject ] ).then( function( resultData ) {
        let modelObjectsArray = relatedObjectsMapping.relatedModelObjects;
        let result;
        if( modelObjectsArray.length === 1 ) {
            if( resultData.designTypes.includes( firstObject ) || resultData.partTypes.includes( firstObject ) ) {
                result = cdmSvc.getObject( modelObjectsArray[ 0 ].props.fnd0UnderlyingObject.dbValues[ 0 ] );
            } else if( resultData.productTypes.includes( firstObject ) ) {
                result = cdmSvc.getObject( modelObjectsArray[ 0 ].uid );
            }
        } else {
            if( resultData.partTypes.includes( firstObject ) ) {
                _.forEach( modelObjectsArray, function( modelObject ) {
                    if( modelObject.props.fnd0IsPrimary.dbValues[ 0 ] === '1' ) {
                        result = cdmSvc.getObject( modelObject.props.fnd0UnderlyingObject.dbValues[ 0 ] );
                    }
                } );
            }
        }
        deferred.resolve( result );
    } );
    return deferred.promise;
};

/**
 * Get Part-CAD aligned/Linked object
 * Note: 1.   if firstObject is Part then return it's Primary Design
 *       2.a. if firstObject is Design then return it's aligned Part if that is the only aligned part to the selected Design
 *  *    2.b. if firstObject is Design and it doesn't have an aligned Part then return the Product EBOM linked to the selected Design
 *       3.   if firstObject is Product then return it's linked object if that is the only linked Object to the selected Product
 *
 * @param {Object} firstObject - First selected object
 * @return {Object} - Part-CAD aligned/Linked object
 */
export let getAlignedObject = function( firstObject ) {
    let deferred = AwPromiseService.instance.defer();

    let promise = cbaOpenInViewPanelService.getProviderAndSectionName( firstObject );
    promise.then( function( resultData ) {
        cbaRelatedObjectService.getRelatedModelObjects( firstObject, resultData.providerName, true ).then( function( relatedModelObjectsArray ) {
            appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_LINKEDBOM_RELATEDMODELOBJECTS, relatedModelObjectsArray );

            if( !relatedModelObjectsArray || relatedModelObjectsArray.length === 0 ) {
                // When the firstObject is Design, the provider we received was the Aligned Parts Provider.
                // This provider hasnt returned any aligned Design Objects. This may imply that the Design has linked EBOM Product.
                // Therefore, we query again to fetch the Linked Products.
                if( resultData.providerName === cbaConstants.ALIGNED_PARTS_PROVIDER ) {
                    cbaRelatedObjectService.getRelatedModelObjects( firstObject, cbaConstants.LINKED_ITEM_PROVIDER, true ).then( function( relatedModelObjectsArray ) {
                        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_LINKEDBOM_RELATEDMODELOBJECTS, relatedModelObjectsArray );

                        if( relatedModelObjectsArray && relatedModelObjectsArray.length === 1 ) {
                            deferred.resolve( relatedModelObjectsArray[ 0 ] );
                        } else {
                            deferred.resolve();
                        }
                    } );
                } else {
                    deferred.resolve();
                }
            } else {
                if( CBAImpactAnalysisService.isImpactAnalysisMode() ) {
                    deferred.resolve( cdmSvc.getObject( relatedModelObjectsArray[ 0 ].uid ) );
                } else {
                    let relatedObjectsMapping = {
                        firstObject: firstObject,
                        relatedModelObjects: relatedModelObjectsArray
                    };

                    _getValidAlignedOrLinkedObjectForCBA( relatedObjectsMapping ).then( function( secondObject ) {
                        deferred.resolve( secondObject );
                    } );
                }
            }
        } );
    } );
    return deferred.promise;
};

/**
 * Get aligned design occurrences' csidchain from input part occurrence
 * Update design product and csidChains in appContext
 * @param {ModelObject[]} selectedObjects - Model objects that are selected
 * @param {String} hostType - Host Type
 *
 */
export let getAlignedDesigns = function( selectedObjects, hostType ) {
    let deferred = AwPromiseService.instance.defer();

    appCtxSvc.unRegisterCtx( 'aw_aligned_designs_csid_chains' );
    appCtxSvc.unRegisterCtx( 'aw_aligned_designs_product' );

    if( selectedObjects && selectedObjects.length > 0 && occmgmtUtils.isMinimumTCVersion( 13, 3 ) ) {
        occmgmtBackingObjectProviderService.getBackingObjects( selectedObjects ).then( function( bomLines ) {
            var partitionLines = [];
            if( hostType === 'NX' ) {
                _.forEach( bomLines, function( bomLine, index ) {
                    if( bomLine.type === 'Ptn0PartitionLine' ) {
                        partitionLines[ index ] = bomLine;
                    }
                } );

                if( partitionLines.length > 0 ) {
                    bomLines = bomLines.filter( item => !partitionLines.includes( item ) );
                }
            }
            if( bomLines.length > 0 ) {
                let input = {
                    partLines: bomLines,
                    requestPref: {}
                };
                let soaInput = {
                    input: input
                };

                soaService.postUnchecked( 'Internal-Bom-2021-12-StructureManagement', 'getAlignedDesigns', soaInput ).then( function( response ) {
                    if( response.alignedOccCsidPaths && response.alignedOccCsidPaths.length > 0 ) {
                        var  allignedCsidChainMap = new Map();
                        let found = false;
                        if( hostType === 'NX' ) {
                            selectedObjects.forEach( function( selectedObject ) {
                                allignedCsidChainMap.set( selectedObject.uid, response.alignedOccCsidPaths );
                            } );
                        } else if( hostType === 'TcIC' ) {
                            //CATIA Integration can not handle duplicated entries for encoded objects
                            //Ensure that only one set of encoded object sent to host application.
                            //If a partition is selected send the all encoded objects for the first partition.
                            selectedObjects.forEach( function( selectedObject ) {
                                if( _.includes( selectedObject.modelType.typeHierarchyArray, 'Fgf0PartitionElement' ) && !found ) {
                                    allignedCsidChainMap.set( selectedObject.uid, response.alignedOccCsidPaths );
                                    found = true;
                                }
                            } );

                            //If we did not find partition in selected list send encoded object for last selected object.
                            if( !found ) {
                                allignedCsidChainMap.set( selectedObjects[ selectedObjects.length - 1 ].uid, response.alignedOccCsidPaths );
                            }
                        }
                        appCtxSvc.updatePartialCtx( 'aw_aligned_designs_csid_chains', allignedCsidChainMap );
                        appCtxSvc.updatePartialCtx( 'aw_aligned_designs_product', response.designProduct );
                    }
                    deferred.resolve();
                } );
            }
        } );
    } else {
        deferred.resolve();
    }
    return deferred.promise;
};

/**
 * Get aligned part occurrences' csidchain from input design occurrence csid chain
 *
 * @param {StringArray} csidChainsOfElementsToFocusOn - List of CSIDs of design occurrence
 *
 * @return {Object} response - Response object from 'getAlignedPartsCsidChain'
 */
export let getAlignedPartOccurrenceCsidChain = function( csidChainsOfElementsToFocusOn ) {
    let deferred = AwPromiseService.instance.defer();
    if( occmgmtUtils.isMinimumTCVersion( 13, 3 ) ) {
        let contextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
        let context = appCtxSvc.getCtx( contextKey );
        let rootElement =  context.rootElement;
        occmgmtBackingObjectProviderService.getBackingObjects( [ rootElement ] ).then( function( bomLines ) {
            if( bomLines.length > 0 ) {
                let input = {
                    inputPartLine: bomLines[ 0 ],
                    occurrenceChains: csidChainsOfElementsToFocusOn,
                    requestPref:{}
                };
                let soaInput = {
                    input: input
                };
                soaService.postUnchecked( 'Internal-Bom-2021-12-StructureManagement', 'getAlignedPartsCsidChain', soaInput ).then( function( response ) {
                    deferred.resolve( response );
                } );
            }
        } );
    }else{
        deferred.resolve();
    }
    return deferred.promise;
};

/**
 * Get source and target object from selected objects
 * Note: If selected objects are invalid to launch in CBA UI then throws proper error message
 *
 * @param {ObjectArray} selectedObjects - Selected objects to launch in CBA
 * @returns {Object} - After validation return promise with source and target object
 */
let _getSrcAndTrgObjectFromSelectedObjects = function( selectedObjects ) {
    let deferred = AwPromiseService.instance.defer();

    let promise = cbaObjectTypeService.getDesignsAndParts( selectedObjects );
    promise.then( function( resultData ) {
        let sourceObject;
        let targetObject;
        let invalidTypes = [];

        _.forEach( selectedObjects, function( selectedObject ) {
            if( !sourceObject && resultData.designTypes.includes( selectedObject ) ) {
                sourceObject = selectedObject;
            } else if( !targetObject && ( resultData.partTypes.includes( selectedObject ) || resultData.productTypes.includes( selectedObject ) ) ) {
                targetObject = selectedObject;
            } else {
                invalidTypes.push( selectedObject );
            }
        } );

        let resultPromise = CadBomAlignmentUtil.isInvalidObjectsForCBA( selectedObjects, invalidTypes );
        resultPromise.then( function( result ) {
            if( result.invalidTypes ) {
                CadBomOccurrenceAlignmentUtil.getErrorMessage( sourceObject, targetObject, result.invalidTypes, result.errorMessageKey ).then( function( errorText ) {
                    messagingService.showError( errorText );
                } );
            } else {
                let output = {
                    sourceObject: sourceObject,
                    targetObject: targetObject
                };
                deferred.resolve( output );
            }
        } );
    } );
    return deferred.promise;
};

/**
 * Get configured params from context
 *
 * Note : While launching CBA from within ACE/saved working context, we want to use saved configuration
 * @param {object} selectedObject - Selected Object
 * @returns {object} - Parameters
 */
let _getConfiguredPCIUid = function( selectedObject ) {
    return appCtxSvc.getCtx( cbaConstants.CTX_PATH_ELEMENT_TO_PCI_MAP ) ? _getPCIForSelection( selectedObject ) : appCtxSvc.getCtx( cbaConstants.CTX_PATH_PRODUCT_CONTEXT_INFO_UID );
};

/**
 * Get parameters for Source and Target from selected objects
 * @param {ObjectArray} selectedObjects - Selected objects from UI
 * @return {Object} - Parameters
 */
let _getParamsFromSelectedObjects = function( commandContext, selectedObjects ) {
    let deferred = AwPromiseService.instance.defer();

    let promise = _getSrcAndTrgObjectFromSelectedObjects( selectedObjects );
    promise.then( function( output ) {
        let toParams = {};

        let sourceObject = output.sourceObject;
        let targetObject = output.targetObject;
        let openedElement = commandContext && commandContext.occContext ? commandContext.occContext.openedElement : null;
        let openedObject = null;
        if( openedElement && openedElement.props && openedElement.props.awb0UnderlyingObject !== undefined ) {
            openedObject = cdmSvc.getObject( openedElement.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }

        if( sourceObject ) {
            toParams.src_uid = sourceObject.uid;
            toParams.uid = sourceObject.uid;

            toParams.spci_uid = '';
            if( appCtxSvc.getCtx( 'aceActiveContext.context' ) ) {
                toParams.spci_uid = _getConfiguredPCIUid( sourceObject );
            }
            if( openedObject && openedObject.uid === sourceObject.uid ) {
                toParams.t_uid = sourceObject.uid;
                toParams.pci_uid = toParams.spci_uid;
            }
        }
        if( targetObject ) {
            toParams.trg_uid = targetObject.uid;
            toParams.uid2 = targetObject.uid;

            toParams.tpci_uid = '';
            if( appCtxSvc.getCtx( 'aceActiveContext.context' ) ) {
                toParams.tpci_uid = _getConfiguredPCIUid( targetObject );
            }
            if( openedObject && openedObject.uid === targetObject.uid ) {
                toParams.t_uid2 = targetObject.uid;
                toParams.pci_uid2 = toParams.tpci_uid;
            }
        }
        deferred.resolve( toParams );
    } );
    return deferred.promise;
};

/**
 * Get selected objects from split mode
 * @param {object} commandContext Command context object
 * @returns {Array} Array contains the selected objects from split mode
 */
let _getSelectedObjectsInSplitMode = function( commandContext ) {
    let selectedObjects = commandContext.occContext.selectedModelObjects;
    let inactiveSelectedModelObject = commandContext.inactiveContext.selectedModelObjects;

    if( inactiveSelectedModelObject.length ) {
        selectedObjects = selectedObjects.concat( inactiveSelectedModelObject );
    }
    return selectedObjects;
};

/**
 * Get multiple selected objects
 * @param {object} commandContext Command context object
 * @return {Object} - Multiple selected objects
 */
let _getMultipleSelectedObjects = function( commandContext ) {
    let selectedElements = [];
    if( commandContext.selectionData && commandContext.selectionData.selected ) {
        if( _.isEmpty( commandContext.selectionData.selected ) && commandContext.occContext && commandContext.occContext.selectedModelObjects ) {
            selectedElements = commandContext.occContext.selectedModelObjects;
        } else {
            selectedElements = commandContext.selectionData.selected;
        }
    } else if( CadBomOccurrenceAlignmentUtil.isNonCBASplitLocation() ) {
        selectedElements = _getSelectedObjectsInSplitMode( commandContext );
    } else {
        selectedElements = appCtxSvc.getCtx( 'mselected' );
    }
    return selectedElements;
};

/**
 * Get first object from selected objects
 *
 * @param {object} mSelected - Multiple selected objects
 * @returns {object} First object from selected objects
 */
let _getFirstObject = function( mSelected ) {
    let firstObject = mSelected[ 0 ];
    if( firstObject.props ) {
        if( firstObject.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
            firstObject = cdmSvc.getObject( firstObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
        } else if( firstObject.props.fnd0UnderlyingObject !== undefined ) { // We got Fnd0AlignedDesign/Fnd0AlignedPart as input
            firstObject = cdmSvc.getObject( firstObject.props.fnd0UnderlyingObject.dbValues[ 0 ] );
        }
    }
    return firstObject;
};

/**
 * Check Whether the object is selected from secondary work area In ACE
 *
 * @param {Object} commandContext - command context object
 * @returns {boolean} True if object is selected from SWA otherwise false
 */
let _isObjectSelectedFromSWAInACE = function( commandContext ) {
    let aceActiveContext = appCtxSvc.getCtx( 'aceActiveContext' );
    let viewModeContextCtx = appCtxSvc.getCtx( 'ViewModeContext' );
    if( viewModeContextCtx && viewModeContextCtx.ViewModeContext === 'TreeSummaryView' ) {
        if( commandContext.selectionData.selected ) {
            let selectionData = commandContext.selectionData;
            if( CadBomAlignmentUtil.isAlignedDesignOrPartSelected( selectionData.selected[ 0 ] ) ) {
                return Boolean( aceActiveContext && selectionData.selected );
            }
        }
    }
    return false;
};

/**
 * Get second selected object in ACE
 * @param {object} mSelected - Multiple selected objects
 * @returns {object} second selected object in ACE
 */
let _getSecondSelectedObjectInACE = function( mSelected ) {
    let secondaryWorkAreaObject = appCtxSvc.ctx.selected;

    let secondObject;
    if( secondaryWorkAreaObject ) {
        secondObject = mSelected[ 0 ].uid === secondaryWorkAreaObject.uid ?
            CadBomAlignmentUtil.getPrimarySelection() : secondaryWorkAreaObject;

        if( secondObject.props && secondObject.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
            secondObject = cdmSvc.getObject( secondObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
        }
        if( secondObject.props && secondObject.props.fnd0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
            secondObject = cdmSvc.getObject( secondObject.props.fnd0UnderlyingObject.dbValues[ 0 ] );
        }
        return secondObject;
    }
    AwPromiseService.instance.all( {
        uiMessages: localeService.getTextPromise( 'CadBomAlignmentMessages' )
    } ).then( function( localizedText ) {
        let deferred = AwPromiseService.instance.defer();
        let errorText;
        errorText = localizedText.uiMessages.InvalidObjectsForAlignment;
        messagingService.showError( errorText );
        deferred.resolve();
    } );
    return null;
};

/**
 * Array contains the xrtSummary Object types for which we need to call getAlignedObject with latest selected object
 */
let makeGetAlignedObjectCallForGivenType = [ 'ChangeNoticeRevision', 'Item' ];

/**
 * Check if Overview tab is selected in SWA
 * @param {Object} commandContext - command context object
 * @returns {boolean} True if Overview tab is selected in SWA otherwise False
 */
let _isOverviewTabActiveInSWA = function( commandContext ) {
    return commandContext.pageContext && 'tc_xrt_Overview' === commandContext.pageContext.secondaryActiveTabId;
};

/**
 * Check if Overview tab is selected in PWA
 * @param {Object} commandContext - command context object
 * @returns {boolean} True if Overview tab is selected in PWA otherwise False
 */
let _isOverviewTabActiveInPWA = function( commandContext ) {
    return commandContext.pageContext && 'tc_xrt_Overview' === commandContext.pageContext.primaryActiveTabId;
};

/**
 * Check if getAlignedObject call is needed when overview tab is active
 * @param {Object} commandContext - command context object
 * @param {object} mSelected - Multiple selected objects
 * @param {object} xrtSummaryContextObject - XRT summary object
 * @returns {boolean} True if getAlignedObject call is needed when overview tab is active otherwise false
 */
let _makeGetAlignedObjectCallInOverviewTab = function( commandContext, mSelected, xrtSummaryContextObject ) {
    // mSelected[0].uid === xrtSummaryContextObject.uid - If only PWA object is selected from folder OR If Object is opened in TreeSummaryView in ACE with no selected object from SWA
    // !_isValidObjectToLaunchInCBA( xrtSummaryContextObject ) - If overview tab selected in SWA outside of ACE .i.e. Home
    return ( _isOverviewTabActiveInSWA( commandContext ) || _isOverviewTabActiveInPWA( commandContext ) ) &&
        ( mSelected[ 0 ].uid === xrtSummaryContextObject.uid || !_isValidObjectToLaunchInCBA( xrtSummaryContextObject ) );
};

/**
 * Check if given object is type of Design/Part/Product
 * @param {*} selectedObject - Selected object
 * @returns {boolean} True if given object is type of Design/Part/Product otherwise false
 */
let _isValidObjectToLaunchInCBA = function( selectedObject ) {
    let partRevisionPreferences = appCtxSvc.ctx.preferences.FND0_PARTREVISION_TYPES;
    let productRevisionPreferences = appCtxSvc.ctx.preferences.FND0_PRODUCTEBOMREVISION_TYPES;
    let designRevisionPreferences = appCtxSvc.ctx.preferences.FND0_DESIGNREVISION_TYPES;

    //Check if type of selected object is belongs to revision preference from ctx
    return partRevisionPreferences && partRevisionPreferences.includes( selectedObject.type ) ||
        productRevisionPreferences && productRevisionPreferences.includes( selectedObject.type ) ||
        designRevisionPreferences && designRevisionPreferences.includes( selectedObject.type );
};

/**
 * Check if other than overview tab is active
 * @param {Object} commandContext - command context
 * @returns {boolean} True if other than overview tab is active otherwisw False
 */
let _isNonOverviewTabActive = function( commandContext ) {
    return !_isOverviewTabActiveInSWA( commandContext ) && !_isOverviewTabActiveInPWA( commandContext );
};

/**
 * Get second object from selected objects
 *
 * Note :
 *  We call getAlignedObject() method for following cases:
 *   1. If objects is opened in ACE-TreeSummaryView and no SWA object is selected
 *   2. If Object is opened in ACE-TreeView/out side ACE any mode without SWA
 *   3. If Overview tab is selected in SWA then check latest selection with XRT summary object
 *   4. If any tab is selected other than Overview tab then call getAlignedObject with PWA selection
 *   5. If overview tab selected in PWA
 *
 * @param {Object} commandContext - command context object
 * @param {object} mSelected - Multiple selected objects
 * @param {object} firstObject - First object
 * @returns {Promise} The promise after fetching second object
 */
let _getSecondObject = function( commandContext, mSelected, firstObject ) {
    let deferred = AwPromiseService.instance.defer();

    if( mSelected.length === 1 ) { // For 1 selection
        let xrtSummaryContextObject = appCtxSvc.getCtx( 'xrtSummaryContextObject' );

        if( _isObjectSelectedFromSWAInACE( commandContext ) && _isOverviewTabActiveInSWA( commandContext ) ) { // If objects are selected from SWA in Overview tab of ACE
            let secondObject = _getSecondSelectedObjectInACE( mSelected );
            if( secondObject ) {
                deferred.resolve( secondObject );
            }
        } else if( !CadBomAlignmentUtil.isAlignedDesignOrPartSelected( mSelected[ 0 ] ) && ( !xrtSummaryContextObject ||
                _makeGetAlignedObjectCallInOverviewTab( commandContext, mSelected, xrtSummaryContextObject ) ||
                xrtSummaryContextObject.modelType.typeHierarchyArray.some( ( val ) => makeGetAlignedObjectCallForGivenType.indexOf( val ) !== -1 ) ||
                _isNonOverviewTabActive( commandContext ) ) ) {
            //  !xrtSummaryContextObject - If object is selected in ACE with tree mode
            // _makeGetAlignedObjectCallInOverviewTab - If Overview tab is active then check latest selection with XRT summary object
            // xrtSummaryContextObject.modelType.typeHierarchyArray.some( ( val ) => makeGetAlignedObjectCallForGivenType.indexOf( val ) !== -1 ) ) -
            //   If object is selected from change summary page OR If primary selected object is type of Item (Launch object in CBA from search)
            // _isNonOverviewTabActive() - If any tab is selected other than Overview tab then call getAlignedObject with pWA selection

            if( !_isOverviewTabActiveInSWA( commandContext ) ) {
                let primarySelectedObject = CadBomAlignmentUtil.getPrimarySelection();

                if( primarySelectedObject && _isValidObjectToLaunchInCBA( primarySelectedObject ) ) {
                    firstObject = primarySelectedObject;
                    if( firstObject.props && firstObject.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
                        firstObject = cdmSvc.getObject( firstObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
                    }
                }
            }
            getAlignedObject( firstObject ).then( function( secondObject ) {
                deferred.resolve( secondObject );
            } );
        } else { //When Object is selected from SWA of outside ACE
            deferred.resolve( cdmSvc.getObject( xrtSummaryContextObject.uid ) );
        }
    } else {
        if( mSelected.length === 2 ) { // For 2 selections
            let secondObject = mSelected[ 1 ];
            if( secondObject.props && secondObject.props.awb0UnderlyingObject !== undefined ) { // We got an Awb0Element as input
                secondObject = cdmSvc.getObject( secondObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
            }
            deferred.resolve( secondObject );
        } else { // For more than 2 selections
            AwPromiseService.instance.all( {
                uiMessages: localeService.getTextPromise( 'CadBomAlignmentMessages' )
            } ).then( function( localizedText ) {
                let deferred = AwPromiseService.instance.defer();
                let errorText;
                errorText = localizedText.uiMessages.InvalidObjectsForAlignment;
                messagingService.showError( errorText );
                deferred.resolve();
            } );
        }
    }
    return deferred.promise;
};

/**
 * Get state params
 * @param {Object} commandContext - command context object
 * @returns {Promise} The promise after fetching state parameters
 */
export let getStateParams = function( commandContext ) {
    let deferred = AwPromiseService.instance.defer();

    let mSelected = _getMultipleSelectedObjects( commandContext );
    let selectedObjects = [];

    let firstObject = _getFirstObject( mSelected );
    selectedObjects.push( firstObject );

    let promise = _getSecondObject( commandContext, mSelected, firstObject );
    promise.then( function( secondObject ) {
        if( secondObject ) {
            selectedObjects.push( secondObject );
        }
        _getParamsFromSelectedObjects( commandContext, selectedObjects ).then( function( toParams ) {
            deferred.resolve( toParams );
        } );
    } );
    return deferred.promise;
};

/**
 * Launch CBA Page
 * @param {object} commandContext Command context object
 * @param {object} optionalData State params to be updated on URL
 */
export let launchCBA = function( commandContext, optionalData ) {
    exports.getStateParams( commandContext ).then( function( result ) {
        appCtxSvc.updatePartialCtx( 'cbaContext.resetTreeExpansionState', true );
        let toParams = result;
        if( optionalData ) {
            _.assign( toParams, optionalData );
        }
        let transitionTo = 'CADBOMAlignment';
        LocationNavigationService.instance.go( transitionTo, toParams );
    } );
};

/**
 * @param {IModelObject} modelObject - The modelObject to access.
 *
 * @returns {String} UID of the immediate parent of the given modelObject based on 'awb0BreadcrumbAncestor' or
 *          'awb0Parent' (or NULL if no parent found).
 */
function _getParentUid( modelObject ) {
    if( modelObject && modelObject.props ) {
        let props = modelObject.props;
        let uid;

        if( props.awb0Parent && !_.isEmpty( props.awb0Parent.dbValues ) ) {
            uid = props.awb0Parent.dbValues[ 0 ];
        }

        if( cdmSvc.isValidObjectUid( uid ) ) {
            return uid;
        }
    }
    return null;
}

/**
 * @param {Object} selectedObject Object representing selection made by the user
 * @returns {string} Uid of the productContext corresponding to the selected object if it is available in the
 *         elementToPCIMap; null otherwise.
 */
let _getPCIForSelection = function( selectedObject ) {
    let _elementToPCIMap = appCtxSvc.getCtx( 'aceActiveContext.context.elementToPCIMap' );
    if( _elementToPCIMap ) {
        let parentObject = selectedObject;
        do {
            if( _elementToPCIMap[ parentObject.uid ] ) {
                return _elementToPCIMap[ parentObject.uid ];
            }
            let parentUid = _getParentUid( parentObject );
            parentObject = cdmSvc.getObject( parentUid );
        } while( parentObject );
    }
    return null;
};

/**
 * Create occurrence alignment input
 *
 * @returns {Array} The list of alignment input object
 */
export let getOccAlignmentInput = function() {
    let alignmentInput = [];

    if( appCtxSvc.ctx && appCtxSvc.ctx.CBASrcContext && appCtxSvc.ctx.CBATrgContext ) {
        let sourceSelectedObjects = appCtxSvc.ctx.CBASrcContext.selectedModelObjects;
        let targetSelectedObjects = appCtxSvc.ctx.CBATrgContext.selectedModelObjects;
        if( sourceSelectedObjects && targetSelectedObjects ) {
            for( let sourceIndex = 0; sourceIndex < sourceSelectedObjects.length; ++sourceIndex ) {
                let sourceObj = sourceSelectedObjects[ sourceIndex ];

                for( let targetIndex = 0; targetIndex < targetSelectedObjects.length; ++targetIndex ) {
                    let targetObj = targetSelectedObjects[ targetIndex ];

                    let partDesOccAlignmentData = {};

                    partDesOccAlignmentData.designOccurrence = sourceObj;
                    partDesOccAlignmentData.partOccurrence = targetObj;

                    alignmentInput.push( partDesOccAlignmentData );
                }
            }
        }
    }
    return alignmentInput;
};

/**
 * Get occurrence unalignment input data for selected objects from either source or target
 *
 * @param {object} srcSelectedObjects - Selected objects from source structure from CBA UI
 * @param {object} trgSelectedObjects - Selected objects from target structure from CBA UI
 * @returns {object} Occurrence unalignment input data
 */
let _getOccUnAlignmentInput = function( srcSelectedObjects, trgSelectedObjects ) {
    let unAlignmentInput = [];
    let selectedObjects = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_SRC ) ? srcSelectedObjects : trgSelectedObjects;

    for( let index = 0; index < selectedObjects.length; ++index ) {
        let selectedObject = selectedObjects[ index ];
        let partDesOccUnAlignmentData = {};
        if( !appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_SRC ) ) {
            partDesOccUnAlignmentData.partOccurrence = selectedObject;
            partDesOccUnAlignmentData.designContext = srcSelectedObjects[ 0 ];
        } else if( !appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_TRG ) ) {
            partDesOccUnAlignmentData.designOccurrence = selectedObject;
            partDesOccUnAlignmentData.partContext = trgSelectedObjects[ 0 ];
        }
        unAlignmentInput.push( partDesOccUnAlignmentData );
    }
    return unAlignmentInput;
};

/**
 * Create occurrence unalignment input
 *
 * @returns {Array} The list of un-alignment input object
 */
export let getOccUnAlignmentInput = function() {
    let unAlignmentInput = [];
    let sourceSelectedObjects = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SRC_SELECTED_OBJECTS );
    let targetSelectedObjects = appCtxSvc.getCtx( cbaConstants.CTX_PATH_TRG_SELECTED_OBJECTS );

    let isSingleSelectionInSrc = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_SRC );
    let isSingleSelectionInTrg = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_TRG );

    if( sourceSelectedObjects && targetSelectedObjects ) {
        if( isSingleSelectionInSrc && isSingleSelectionInTrg ) {
            for( let sourceIndex = 0; sourceIndex < sourceSelectedObjects.length; ++sourceIndex ) {
                let sourceObj = sourceSelectedObjects[ sourceIndex ];
                for( let targetIndex = 0; targetIndex < targetSelectedObjects.length; ++targetIndex ) {
                    let targetObj = targetSelectedObjects[ targetIndex ];
                    let partDesOccUnAlignmentData = {};

                    partDesOccUnAlignmentData.designOccurrence = sourceObj;
                    partDesOccUnAlignmentData.partOccurrence = targetObj;

                    unAlignmentInput.push( partDesOccUnAlignmentData );
                }
            }
        } else {
            unAlignmentInput = _getOccUnAlignmentInput( sourceSelectedObjects, targetSelectedObjects );
        }
    }
    return unAlignmentInput;
};

/**
 * Creates input for unalignment confirmation message
 * @returns {string} Returns name of the object if there is a single selection on source or target else returns the count of selected objects
 */
export let getUnAlignmentConfirmationInput = function() {
    let unAlignConfirmationInput = [];
    let srcSelections = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SRC_SELECTED_OBJECTS );
    let trgSelections = appCtxSvc.getCtx( cbaConstants.CTX_PATH_TRG_SELECTED_OBJECTS );

    let isSingleSelectionInSrc = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_SRC );
    let isSingleSelectionInTrg = appCtxSvc.getCtx( cbaConstants.CTX_PATH_IS_SINGLE_SELECT_IN_TRG );

    if( srcSelections && trgSelections ) {
        let sourceSelectedLength = srcSelections.length;
        let targetSelectedLength = trgSelections.length;

        if( isSingleSelectionInSrc && isSingleSelectionInTrg ) {
            if( sourceSelectedLength === 1 && targetSelectedLength === 1 ) {
                unAlignConfirmationInput.push( _getObjectName( srcSelections ) );
                unAlignConfirmationInput.push( _getObjectName( trgSelections ) );
            } else if( sourceSelectedLength > targetSelectedLength ) {
                unAlignConfirmationInput.push( sourceSelectedLength );
                unAlignConfirmationInput.push( _getObjectName( trgSelections ) );
            } else {
                unAlignConfirmationInput.push( _getObjectName( srcSelections ) );
                unAlignConfirmationInput.push( targetSelectedLength );
            }
        } else if( isSingleSelectionInSrc ) {
            unAlignConfirmationInput.push( sourceSelectedLength > 1 ? sourceSelectedLength : _getObjectName( srcSelections ) );
        } else {
            unAlignConfirmationInput.push( targetSelectedLength > 1 ? targetSelectedLength : _getObjectName( trgSelections ) );
        }
    }
    return unAlignConfirmationInput;
};

/**
 * Returns name of the selected object
 *
 * @param {object} context source or target context
 * @returns {string} the object name
 */
let _getObjectName = function( selectedObject ) {
    let objectName;
    if( selectedObject ) {
        objectName = selectedObject[ 0 ].props.object_string.dbValues[ 0 ];
    }
    return objectName;
};

export let clearCbaContext = function() {
    return {
        srcStructure: '',
        trgStructure: '',
        isCBAFirstLaunch: false,
        ImpactAnalysis: {},
        linkedBOM: ''

    };
};
export let refreshCba = function( data, cbaContext ) {
    loadCBAData( cbaContext, data.eventData );
};

/**
 * CAD-BOM Occurrence Alignment service
 */
const exports = {
    initializeServiceForCBA,
    loadCBAData,
    launchCBA,
    getStateParams,
    getOccAlignmentInput,
    getOccUnAlignmentInput,
    getUnAlignmentConfirmationInput,
    getAlignedObject,
    clearCbaContext,
    refreshCba,
    getAlignedDesigns,
    getAlignedPartOccurrenceCsidChain
};
export default exports;
