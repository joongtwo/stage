/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 *
 * @module js/Cm1ChangeSummaryService
 */
import { getBaseUrlPath } from 'app';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import awTableSvc from 'js/awTableService';
import awStructureCompareSvc from 'js/awStructureCompareService';
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';
import preferenceService from 'soa/preferenceService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import localeSvc from 'js/localeService';
import LocationNavigationService from 'js/locationNavigation.service';
import compareSvc from 'js/structureCompareService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import awCompare from 'js/awCompare.service';
import eventBus from 'js/eventBus';
import cmUtils from 'js/changeMgmtUtils';
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';
import iconSvc from 'js/iconService';
import htmlUtil from 'js/htmlUtils';
import tableSvc from 'js/published/splmTablePublishedService';
import occmgmtUtils from 'js/occmgmtUtils';

//Cached reference to AngularJS & AW services.
var exports = {};
var supportedSOA = {};
var isPreviousRowBottomBorder = false;
var isSupersedure = false;

/**
  * Call getChangeSummaryData to render change summary table
  * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
  */
export let getChangeSummaryData = function( treeLoadInput, dataProvider, isGenealogy ) {
    //Deferred response
    var deferred = AwPromiseService.instance.defer();

    //Check the validity of the parameters
    var failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );

    if( failureReason ) {
        deferred.reject( failureReason );
        return deferred.promise;
    }

    //get tree nodes via SOA
    return generateChangeSummaryTableData( treeLoadInput, dataProvider, isGenealogy );
};

/**
  * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
  */
function generateChangeSummaryTableData( treeLoadInput, dataProvider, isGenealogy ) {
    //Call SOA getChangeSummaryData
    return getChangeSummaryDataSOA( treeLoadInput, dataProvider, isGenealogy ).then(
        function( dataForChangeSummaryTable ) {
            //Process SOA Response
            var treeLoadResult = processGetChangeSummaryDataResponse( dataForChangeSummaryTable,
                treeLoadInput, dataProvider );

            // Return output to render change summary table
            return {
                treeLoadResult: treeLoadResult,
                columnConfig:dataProvider.columnConfig,
                columns:dataProvider.columnConfig.columns
            };
        } );
}
/**
  * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  * @return {dataForChangeSummaryTable} Data Required to render change summary table like vmo, columns
  */
function getChangeSummaryDataSOA( treeLoadInput, dataProvider, isGenealogy ) {
    // getChangeSummaryData requires following input
    // 1. changeNoticeRevision - Selected ChangeNoticeRevision
    // 2. selectedRow - Selected Object from Change Summary table( In case of expanding parent )
    // 3. isOddRowSelected - Flag to indicate whether selected row is rendered as odd background color or even background color.
    //                       Based on this background color flag for child row is calculated on server.
    // 4. startIndex - StartIndex for next page. Change Summary table pagination at first level.
    // 5. pageSize - Number of objects should be returned per SOA call. Change Summary Table only support pagination at first level.
    // Get the SOA input data
    var inputData = cmUtils.getChangeSummaryInputData( appCtxSvc.ctx, treeLoadInput, dataProvider, isGenealogy );

    // Set Input
    var soaInput = {
        changeSummaryInput: inputData
    };

    var policy = {
        types: [ {
            name: 'WorkspaceObject',
            properties: [ {
                name: 'object_string'
            } ]
        } ]
    };

    //Register Policy
    var policyId = propPolicySvc.register( policy );

    // Get the service name based on tc server release
    if ( !supportedSOA.serviceName ) {
        supportedSOA = cmUtils.getSupportedChangeSummarySOA( appCtxSvc.ctx );
    }

    // Call SOA to get the data
    return soaSvc.post( supportedSOA.serviceName, supportedSOA.operationName, soaInput ).then(
        function( response ) {
            //UnRegister Policy
            if( policyId ) {
                propPolicySvc.unregister( policyId );
            }
            var dataObjects = response.dataObjects;
            var vmos = [];
            dataObjects.forEach( function( dataObject ) {
                //Create a view model object
                if( dataObject ) {
                    createViewModelObjectFromSOADataObject( dataObject, vmos );
                }
            } );

            // Return viewmodelobject, total number of vmo, end index of page and column information
            return {
                searchResults: vmos,
                totalFound: response.totalFound, // This can be different than total numner of vmo. Total numnber is nummber of solutions loaded. But vmos an contain some of the impacted to display strikthrough
                endIndex: response.endIndex,
                currentColumnConfig: response.currentColumnConfig,
                defaultColumnConfig: response.defaultColumnConfig
            };
        } );
}

/**
  * Check if input object is of type input type. If yes then
  * return true else return false.
  *
  * @param {Object} obj Object to be match
  * @param {String} type Object type to match
  *
  * @return {boolean} True/False
  */
var isOfType = function( obj, type ) {
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};


/**
  * @param {ChangeSummaryTableDataObject} dataObject - DataObject from SOA
  * @param {ViewModelObject} vmos - Array of all View Model Objects
 * @param {Boolean} isProductBOM - If primaryObject is of type PartUsage, isProductBOM is set to true for its sibilings
  * @return {ViewModelObject} ViewModelObject.
  */
function createViewModelObjectFromSOADataObject( dataObject, vmos, isProductBOM = false ) {
    //Process each dataObject ( ChangeSummaryTableDataObject ) received in response and create a ViewModelObject.
    var vmo = undefined;

    if( dataObject.primaryObject && dataObject.primaryObject.uid && dataObject.primaryObject.uid !== 'AAAAAAAAAAAAAA' ) {
        vmo = viewModelObjectService.createViewModelObject( dataObject.primaryObject.uid );
    } else {
        if( dataObject.secondaryObject ) {
            vmo = viewModelObjectService.createViewModelObject( dataObject.secondaryObject.uid );
        }
    }

    //set Primary and secondary objects for compare.
    vmo.primaryObjectUid = dataObject.primaryObject.uid;
    vmo.secondaryObjectUid = dataObject.secondaryObject.uid;

    //Current vmo row has odd row color
    vmo.isOdd = cmUtils.getAdditionalDataValue( dataObject, 'isOddRow', true );

    //is current vmo row has children
    vmo.hasChildren = cmUtils.getAdditionalDataValue( dataObject, 'hasChildren', true );

    //is compare button required for the row
    vmo.isCompareRow = cmUtils.getAdditionalDataValue( dataObject, 'isCompareRow', true );

    vmo.isAbsOccInContextParent = cmUtils.getAdditionalDataValue( dataObject, 'isAbsOccInContextParent', true );

    //Added to provide supersedure functionality
    vmo.bomEditUid = cmUtils.getAdditionalDataValue( dataObject, 'bomEditId', false );
    vmo.bomEditParentBVR = cmUtils.getAdditionalDataValue( dataObject, 'bomEditParentBVR', false );
    vmo.bomEditSupersedure = cmUtils.getAdditionalDataValue( dataObject, 'bomEditSupersedure', false );
    vmo.bomEditType = cmUtils.getAdditionalDataValue( dataObject, 'bomEditType', false );
    vmo.bomEditType = cmUtils.getAdditionalDataValue( dataObject, 'bomEditType', false );
    vmo.supersedure_begin = cmUtils.getAdditionalDataValue( dataObject, 'Supersedure_Begin', false );
    vmo.supersedure_end = cmUtils.getAdditionalDataValue( dataObject, 'Supersedure_End', false );

    // Get the supporting secondary object and if not null then set to VMO
    var supportingSecondaryVMO = null;
    if( dataObject.supportingSecondaryObject && dataObject.supportingSecondaryObject.uid && dataObject.supportingSecondaryObject.uid !== 'AAAAAAAAAAAAAA' ) {
        supportingSecondaryVMO = viewModelObjectService.createViewModelObject( dataObject.supportingSecondaryObject.uid );
    }
    vmo.supportingSecondaryVMO = supportingSecondaryVMO;

    //set supporting primary object
    var supportingPrimaryVMO = null;
    if( dataObject.supportingPrimaryObject && dataObject.supportingPrimaryObject.uid && dataObject.supportingPrimaryObject.uid !== 'AAAAAAAAAAAAAA' ) {
        supportingPrimaryVMO = viewModelObjectService.createViewModelObject( dataObject.supportingPrimaryObject.uid );
    }
    vmo.supportingPrimaryVMO = supportingPrimaryVMO;

    //Changing type icon for Part Usage
    if(  supportingPrimaryVMO && supportingPrimaryVMO.modelType.typeHierarchyArray.indexOf( 'Ebm0PartUsageRevision' ) > -1
    ||  supportingSecondaryVMO && supportingSecondaryVMO.modelType.typeHierarchyArray.indexOf( 'Ebm0PartUsageRevision' ) > -1
    || isProductBOM ) {
        vmo.typeIconURL = iconSvc.getTypeIconURL( 'Ebm0PartUsageRevision' );
        // Setting isProductBOM to true for sibling objects, this is required for replace use case where
        // supportingPrimaryObject or supportingSecondaryObject is not present.
        isProductBOM = true;
    }

    // Process each properties (  ChangeSummaryTableObjectProperty ) for a ChangeSummaryTableDataObject
    dataObject.objectProperties.forEach( function( dataProperty ) {
        // Current value
        var propValue = '';
        var propValueArray = [];
        if( dataProperty.currentUIValue ) {
            propValue = dataProperty.currentUIValue.toString();
            propValueArray = dataProperty.currentUIValue;
        }

        var propDbValueArray = [];
        if( dataProperty.currentDBValue ) {
            propDbValueArray = dataProperty.currentDBValue;
        }

        // old value - used to display strikethrough
        var propOldValue = '';
        var propOldValueArray = [];
        if( dataProperty.oldUIValue ) {
            propOldValue = dataProperty.oldUIValue.toString();
            propOldValueArray = dataProperty.oldUIValue;
        }

        var propOldDbValueArray = [];
        if( dataProperty.oldDBValue ) {
            propOldDbValueArray = dataProperty.oldDBValue;
        }

        //Create a ViewModelProperty
        var dispValue = [];
        var propVM = uwPropertyService.createViewModelProperty( dataProperty.propInternalName,
            dataProperty.propInternalName, 'String', '', dispValue );
        if( dataProperty.currentDBValue ) {
            propVM.dbValue = dataProperty.currentDBValue;
        }
        propVM.uiValue = propValue;
        propVM.uiValues = propValueArray;
        delete propVM.displayValue;
        delete propVM.displayValues;

        propVM.currentValue = propValue;
        propVM.currentValues = propValueArray;

        if( propValue !== propOldValue ) {
            propVM.oldValue = propOldValue;
            propVM.oldValues = propOldValueArray;
        }

        propVM.dbValues = ( function() {
            var dbValues = [];
            for( var i = 0; i < propDbValueArray.length; i++ ) {
                dbValues.push( propDbValueArray[ i ] );
            }
            return dbValues;
        } )();
        propVM.currentDbValueArray = propDbValueArray;
        propVM.oldDbValueArray = propOldDbValueArray;

        propVM.inputStyle = '';

        // If dataProperty.oldDBValue and dataProperty.currentDBValue is populated with values, consider it as Reference type of property.
        // Currently we are populating dataProperty.oldDBValue and dataProperty.currentDBValue only for Reference type property.
        // The property type needs to be returned from server insted of relying on dbValues. When we write new SOA version this needs to be handled.
        propVM.type = 'STRING';
        if( dataProperty.currentDBValue || dataProperty.oldDBValue ) {
            propVM.type = 'OBJECT';
        }

        //Add a style for Remove Cell
        if( dataProperty.propInternalName === 'action' ) {
            if( propDbValueArray[0] === 'Remove' || propDbValueArray[0] === 'Replace' ) {
                propVM.isChangeCell = true;
                propVM.internalActionName = propDbValueArray[0];
            }
            propVM.type = 'STRING';
        }

        //Calculate Tooltip property values
        calculateToolTipValues( dataProperty, propVM );

        vmo.props[ dataProperty.propInternalName ] = propVM;

        if( dataProperty.propInternalName === 'm_mergeStatus' ) {
            //Create a ViewModelProperty
            var mergeDispValue = [];
            var mergePropVM = uwPropertyService.createViewModelProperty( 'mergeStatus',
                'mergeStatus', 'String', '', mergeDispValue );
            mergePropVM.displayValues = dataProperty.currentUIValue;
            mergePropVM.dbValues = dataProperty.currentDBValue;
            mergePropVM.commonDisplayValues = propVM.commonDisplayValues;
            mergePropVM.commonInternalValues = propVM.commonInternalValues;
            //Create a ViewModelProperty
            vmo.props.mergeStatus = mergePropVM;
        }
    } );

    vmos.push( vmo );

    //Process sibling data object
    vmo.siblingDataObjects = [];
    var siblingDataObjects = dataObject.siblingDataObjects;
    siblingDataObjects.forEach( function( siblingDataObject ) {
        var siblingVmo = createViewModelObjectFromSOADataObject( siblingDataObject, vmos, isProductBOM );
        vmo.siblingDataObjects.push( siblingVmo );
    } );

    return vmo;
}

/**
  * @param {ChangeSummaryTableDataObject} dataProperty -property from SOA
  * @param {ViewModelProperty} propVM - View Model Property
  */
function calculateToolTipValues( dataProperty, propVM ) {
    // If dbValue is not present than consider uiValues as dbValues.

    var currentUIValuesToProcess = dataProperty.currentUIValue;
    var oldUIValuesToProcess = dataProperty.oldUIValue;

    var currentDBValuesToProcess = [];
    if( dataProperty.currentDBValue ) {
        currentDBValuesToProcess = dataProperty.currentDBValue;
    } else {
        currentDBValuesToProcess = dataProperty.currentUIValue;
    }

    var oldDBValuesToProcess = [];
    if( dataProperty.oldDBValue ) {
        oldDBValuesToProcess = dataProperty.oldDBValue;
    } else {
        oldDBValuesToProcess = dataProperty.oldUIValue;
    }

    var addedDisplayValues = [];
    var addedInternalValues = [];

    var removedDisplayValues = [];
    var removedInternalValues = [];

    var commonDisplayValues = [];
    var commonInternalValues = [];

    var isArrayProperty = false; // If any of one of the property contain more than one value consider it as array property.
    if( currentDBValuesToProcess !== undefined && currentDBValuesToProcess.length > 1 || oldDBValuesToProcess !== undefined && oldDBValuesToProcess.length > 1 ) {
        isArrayProperty = true;
    }

    if( !isArrayProperty ) {
        // For non-array property value add current value to commonValues and old values to removed values.
        if( currentDBValuesToProcess !== undefined ) {
            commonDisplayValues.push( currentUIValuesToProcess[ 0 ] );
            commonInternalValues.push( currentDBValuesToProcess[ 0 ] );
        }

        if( oldDBValuesToProcess !== undefined ) {
            if( currentDBValuesToProcess === undefined || oldDBValuesToProcess[ 0 ] !== currentDBValuesToProcess[ 0 ] ) { // Extra check if current value and old value are same don't show old value.
                removedDisplayValues.push( oldUIValuesToProcess[ 0 ] );
                removedInternalValues.push( oldDBValuesToProcess[ 0 ] );
            }
        }
    } else {
        // For array property values
        // If old value doesn't contain current value consider it as added value
        // If current value doesn't contain old value consider it as removed value
        // Else it is common values.
        if( currentDBValuesToProcess !== undefined ) {
            for( var i in currentDBValuesToProcess ) {
                if( oldDBValuesToProcess !== undefined && !oldDBValuesToProcess.includes( currentDBValuesToProcess[ i ] ) ) {
                    addedDisplayValues.push( currentUIValuesToProcess[ i ] );
                    addedInternalValues.push( currentDBValuesToProcess[ i ] );
                } else {
                    commonDisplayValues.push( currentUIValuesToProcess[ i ] );
                    commonInternalValues.push( currentDBValuesToProcess[ i ] );
                }
            }
        }

        if( oldDBValuesToProcess !== undefined ) {
            for( i in oldDBValuesToProcess ) {
                if( currentDBValuesToProcess === undefined || !currentDBValuesToProcess.includes( oldDBValuesToProcess[ i ] ) ) {
                    removedDisplayValues.push( oldUIValuesToProcess[ i ] );
                    removedInternalValues.push( oldDBValuesToProcess[ i ] );
                } else {
                    if( !commonInternalValues.includes( oldDBValuesToProcess[ i ] ) ) {
                        commonDisplayValues.push( oldUIValuesToProcess[ i ] );
                        commonInternalValues.push( oldDBValuesToProcess[ i ] );
                    }
                }
            }
        }
    }

    // set comparision set on view model property.
    propVM.isArray = isArrayProperty;
    propVM.addedDisplayValues = addedDisplayValues;
    propVM.addedInternalValues = addedInternalValues;

    propVM.removedDisplayValues = removedDisplayValues;
    propVM.removedInternalValues = removedInternalValues;

    propVM.commonDisplayValues = commonDisplayValues;
    propVM.commonInternalValues = commonInternalValues;
}

/**
  * @param {response} dataForChangeSummaryTable - Required to render change summary table like vmo, columns
  * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
  */
function processGetChangeSummaryDataResponse( dataForChangeSummaryTable, treeLoadInput, dataProvider ) {
    //If TopNode than response should also have column information. So update the column information on data provider.
    var isTopNode = treeLoadInput.parentNode.levelNdx === -1;
    if( isTopNode ) {
        exports.initColumnsForChangeSummaryTable( dataForChangeSummaryTable.currentColumnConfig, dataProvider );

        //Set default column configuration on data provider which can be used in reset action
        dataProvider.defaultColumnConfig = dataForChangeSummaryTable.defaultColumnConfig;
    }

    // total number of rows
    var tableRows = dataForChangeSummaryTable.searchResults;

    //Change Summary table Support pagination only at first level. So determine whether all of data is loaded aat first level or not.
    var endReached = false;
    var totalFound = dataForChangeSummaryTable.totalFound;
    var totalLoaded = dataForChangeSummaryTable.endIndex;
    if( totalLoaded >= totalFound ) {
        endReached = true;
    }

    // Set current end inxed on data provider so subsequent call to get next page of data can retrun data from this index.
    if( isTopNode ) {
        dataProvider.startIndexForNextPage = totalLoaded;
    }

    //Get first column name and set it on row.
    var firstColumnName = dataProvider.columnConfig.columns[ 0 ].name;

    var children = [];
    treeLoadInput.compareCriteria = new Object();
    appCtxSvc.registerCtx( 'prevSelectedObjectType', [] );
    for( var index = 0; index < tableRows.length; index++ ) {
        var tableRow = createTreeNode( tableRows[ index ], index, treeLoadInput, firstColumnName );

        //set incompleteTail on last vmo in this for loop. If not all of solutions are loaded than set incompleteTail to true so subsequent call will get next page of data.
        if( index === tableRows.length - 1 && !endReached && isTopNode ) {
            tableRow.incompleteTail = true;
        }

        //Add childrent
        children.push( tableRow );
    }

    // If loading change summary for first time create a ViewModelTreeNode for ECN and set that as root node for Tree
    var newTopNode = undefined;
    var tempCursorObject = {
        startReached: true,
        endReached: endReached
    };
    var rootPathNodes = [];
    if( isTopNode ) {
        var selectedECN = appCtxSvc.ctx.selected;
        var parentVMO = awTableSvc.createViewModelTreeNode( selectedECN.uid, selectedECN.type,
            selectedECN.modelType.displayName, -1, 0, null );

        if( treeLoadInput.parentNode.uid !== selectedECN.uid ) {
            newTopNode = parentVMO;
            newTopNode.cursorObject = tempCursorObject;
        }
        rootPathNodes.push( parentVMO );
    }

    //Next page of data is retrive via variable incompleteTail on a node. So setting end and start as true.
    var endReachedVar = true;
    var startReachedVar = true;

    //Generate Tree Load Result
    var treeLoadResult = awTableSvc.buildTreeLoadResult( treeLoadInput, children, true, startReachedVar,
        endReachedVar, newTopNode );
    treeLoadResult.rootPathNodes = rootPathNodes;

    return treeLoadResult;
}

/**
  * @param {ViewModelObject} vmo - ViewModelObject
  * @param {integer} index - index of object
  * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
  * @param {Integer} firstColumnName - Name of first column in Table
  * @return {TreeViewModelObject} View Model object to display in Tree.
  */
function createTreeNode( vmo, index, treeLoadInput, firstColumnName ) {
    var tableRow = vmo;

    // Get Icon URL from vmo
    var iconURL = tableRow.typeIconURL;

    // Index of current level. When loading change summary table for first time treeLoadInput.parentNode.levelNdx is -1. So incrementing to 1 will make first level row index as 0.
    // For sub sequent expansion it index will be one more than the parent level.
    var treeLevel = treeLoadInput.parentNode.levelNdx + 1;

    // Create ViewModelTreeNode
    var vmNode = awTableSvc.createViewModelTreeNode( tableRow.uid, tableRow.type, tableRow.props[firstColumnName].currentValue, treeLevel, index,
        iconURL );

    // Add all properties from dataobject vmo to TreeNode vmo
    vmNode.props = tableRow.props;

    //Is leaf node ?
    vmNode.isLeaf = !tableRow.hasChildren;

    //Is row having background color of odd type
    vmNode.isOdd = tableRow.isOdd;

    vmNode.isAbsOccInContextParent = tableRow.isAbsOccInContextParent;

    //is Peer Row
    vmNode.isPeerRow = false; //tableRow.isPeerRow;

    vmNode.isCompareRow = tableRow.isCompareRow;

    //Support Supersedure functionality
    vmNode.bomEditUid = tableRow.bomEditUid;
    vmNode.bomEditParentBVR = tableRow.bomEditParentBVR;
    vmNode.bomEditSupersedure = tableRow.bomEditSupersedure;
    vmNode.bomEditType = tableRow.bomEditType;
    vmNode.supersedure_begin = tableRow.supersedure_begin;
    vmNode.supersedure_end = tableRow.supersedure_end;


    //Generating unique id for each row. We can't reply on uid as we can have same object multiple time in same table.
    var id = vmNode.id + treeLoadInput.parentNode.id + vmNode.props.action.currentValue + index + treeLoadInput.parentNode.levelNdx;
    vmNode.id = id;

    //setting ModelType on TreeNode.
    vmNode.modelType = tableRow.modelType;

    vmNode.supportingSecondaryObject = tableRow.supportingSecondaryVMO;

    vmNode.supportingPrimaryObject = tableRow.supportingPrimaryVMO;

    // Get the parent node name for current node
    if( treeLoadInput.parentNode && treeLoadInput.parentNode.props && treeLoadInput.parentNode.props.NAME
     && treeLoadInput.parentNode.props.NAME.currentValue ) {
        vmNode.parentNodeName = treeLoadInput.parentNode.props.NAME.currentValue;
    }

    // Check if supportingPrimaryObject is present and is of type AbsOccurrence then we need to show
    // in context icon for properties that are modified
    if( vmNode.supportingPrimaryObject && isOfType( vmNode.supportingPrimaryObject, 'AbsOccurrence' )  && vmNode.parentNodeName ) {
        var parentNodeName = vmNode.parentNodeName;
        localeSvc.getLocalizedText( 'ChangeMessages', 'overridesForContext' ).then( function( result ) {
            var overridesLabel = result.replace( '{0}', parentNodeName );
            vmNode.overrideContext = overridesLabel;

            // Check if props is present on node then we need to override the commonDisplayValues
            // and commonInternalValues as these properties are being used to show the tooltip and
            // in case of in-context change for action column we need to show this as tooltip.
            if(  vmNode.props && vmNode.props.action ) {
                vmNode.props.action.commonDisplayValues = [ overridesLabel ];
                vmNode.props.action.commonInternalValues =  [ overridesLabel ];
            }
        } );
    }

    //Set First column name
    vmNode.firstColumnName = firstColumnName;
    vmNode.compareCandidates = [];

    //Set First column name
    if( vmNode.isCompareRow || vmo.props.action.dbValues[0] === 'Modify' ) {
        vmNode.primaryObjectUid = tableRow.primaryObjectUid;
        vmNode.secondaryObjectUid = tableRow.secondaryObjectUid;
        if ( vmo.props.action.dbValues[0] === 'Modify' ) {
            vmNode.compareCandidates.push( tableRow.secondaryObjectUid );
            vmNode.compareCandidates.push( tableRow.primaryObjectUid );
        }
    }

    //compareCandidates for each sibling Node
    if ( treeLoadInput.compareCriteria[vmNode.uid] !== undefined ) {
        vmNode.compareCandidates = treeLoadInput.compareCriteria[vmNode.uid];
    }
    if ( tableRow.siblingDataObjects.length > 0 ) {
        reOrderCompareReplaceNodes( vmNode, tableRow, treeLoadInput );
    }

    //process sibling data object
    vmNode.siblingNodes = [];
    for( var sb = 0; sb < tableRow.siblingDataObjects.length; sb++ ) {
        var siblingNode = createTreeNode( tableRow.siblingDataObjects[ sb ], sb, treeLoadInput, firstColumnName );
        vmNode.siblingNodes.push( siblingNode );
        treeLoadInput.compareCriteria[siblingNode.uid] = vmNode.compareCandidates;
        treeLoadInput.compareCriteria[siblingNode.uid].primaryAction = 'Replace';
    }

    return vmNode;
}

/**
  * sibling node uid array is ordered based on Removed Nodes are added first in array
  * and Added Nodes are added next for Replace Action
  * @param {*} vmNode  - Replace Action Node
  * @param {*} tableRow
  * @param {*} treeLoadInput
  *
  */
function reOrderCompareReplaceNodes( vmNode, tableRow, treeLoadInput ) {
    tableRow.siblingDataObjects.map( function( sibNode ) {
        if ( sibNode.primaryObjectUid !== undefined && sibNode.primaryObjectUid === 'AAAAAAAAAAAAAA' ) {
            return vmNode.compareCandidates.push( sibNode.uid );
        }
    } );
    vmNode.compareCandidates.push( vmNode.uid );

    tableRow.siblingDataObjects.map( function( sibNode ) {
        if ( sibNode.secondaryObjectUid !== undefined && sibNode.secondaryObjectUid === 'AAAAAAAAAAAAAA' ) {
            return vmNode.compareCandidates.push( sibNode.uid );
        }
    } );
}

/**
  * Initialize columns for Change Summary Table.
  * Actual columns will be retrive when first time "getChangeSummaryData" SOA call is made to retrive data for the table.
  *
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  *
  */
export let loadInitialColumns = function( dataProvider ) {
    var awColumnInfos = [];
    // Create an empty columns
    var columnInfo = {
        name: '...',
        displayName: '...',
        typeName: ''
    };

    var awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );
    awColumnInfos.push( awColumnInfo );

    // Set columnConfig to Data Provider.
    dataProvider.columnConfig = {
        columns: awColumnInfos
    };
};

/**
  * Generate in-context icon if property value is modified in context
  * @param { Object } vmo - ViewModelObject for which in context is being rendered
  * @param { Object } cellContent - The container DOM Element inside which in context will be rendered
  * @param { Object } imgTitle - Image title to be set on image
  */
var _generateOverrideContextIcon = function( vmo, cellContent, imgTitle ) {
    let imagePath = getBaseUrlPath() + '/image/indicatorOverridden16.svg';
    var celRequiredImg = document.createElement( 'img' );
    celRequiredImg.className = 'aw-visual-indicator';
    celRequiredImg.title = imgTitle;
    celRequiredImg.src = imagePath;
    celRequiredImg.alt = vmo.modelType && vmo.modelType.displayName ? vmo.modelType.displayName : '';
    if( celRequiredImg ) {
        var requiredImageDiv = htmlUtil.createElement( 'div', tableSvc.CLASS_GRID_CELL_IMAGE );
        requiredImageDiv.appendChild( celRequiredImg );
        cellContent.appendChild( requiredImageDiv );
    }
};

/**
  * Generate in-context icon if property value is modified in context
  * @param { Object } vmo - ViewModelObject for which in context is being rendered
  * @param { Object } column - Column for renderer need to be used
  * @param { Object } tableElem - The container DOM Element inside which in context will be rendered
  *
  */
var _populateOverrideContextIcon = function( vmo, column, cellContent ) {
    // Check if VMO object is not null and isAbsOccInContextParent present for this VMO this means
    // some property for it's children node has been overridden in context and we need to show in context icon
    // only for action column.
    if( vmo && column && vmo.isAbsOccInContextParent && column.name === 'action' ) {
        _generateOverrideContextIcon( vmo, cellContent, '' );
    } else if( vmo && column && vmo.overrideContext ) {
        // Check if VMO object is not null and overrideContext present for this VMO this means
        // some property for this node has been overridden in context and we need to show in context icon.
        var uiValue = vmo.props[ column.name ].uiValue;
        var oldValue = vmo.props[ column.name ].oldValue;
        // Check if column name is action or old value and previous value is not matched then we need to render
        // in-context icon
        if( column.name === 'action' ||  oldValue && uiValue !== oldValue  ) {
            _generateOverrideContextIcon( vmo, cellContent, vmo.overrideContext );
        }
    }
};

/**
  * Adds the extended tooltip to PL Table cell
  */
var _addExtendedTooltip = function( cellContent, column, vmo, tableElem ) {
    var uiValue = vmo.props[ column.name ].uiValue;
    var oldValue = vmo.props[ column.name ].oldValue;
    if( column.isCompareColumn === true || uiValue === '' && oldValue === undefined ) {
        return cellContent;
    }

    var tooltipDetails = {
        vmo: vmo,
        prop: vmo.props[ column.field ]
        // Commenting the below method. This is throwing an error about runActionWithViewModel for execute call.
        /* openObjectChange: function( uid, propName ) {
            if( uid && uid.length > 0 ) {
                showObjectSvc.execute( {
                    propertyName: propName,
                    uid: uid
                } );
            }
        } */
    };

    const subPanelContext = { tooltipDetails };
    let extendedTooltipElement = includeComponent( 'Cm1ChangeSummaryExtendedTooltip', subPanelContext );
    let renderedElement = document.createElement( 'div' );

    let appendExtendedTooltipElement = function( cellContent ) {
        if( column.name === 'action' && cellContent.childNodes.length && renderedElement.lastChild ) {
            renderedElement.lastChild.appendChild( cellContent.childNodes[ 0 ] );
        } else{
            if( cellContent.childNodes.length > 0 && renderedElement.lastChild ) {
                renderedElement.lastChild.appendChild( cellContent.childNodes[ 0 ] );
            }
        }
    };

    let appendExtendedTooltipCallBack = function() {
        setTimeout(  function() { appendExtendedTooltipElement( cellContent ); }, 100 );
    };

    if( renderedElement ) {
        renderComponent( extendedTooltipElement, renderedElement, appendExtendedTooltipCallBack );
    }
    // Populate in-context icon if need to be rendered
    _populateOverrideContextIcon( vmo, column, renderedElement, tableElem );
    renderedElement.className = cellContent.className;
    return renderedElement;
};

/**
  * Table Tree Cell Renderer for PL Table
  */
var _treeCellRenderer = {
    action: function( column, vmo, tableElem, rowElem ) {
        // Check for removed value
        var isRemovedValue = false;
        if( !vmo.props[ vmo.firstColumnName ].currentValue ) {
            if( vmo.props[ vmo.firstColumnName ].oldValue ) {
                vmo.displayName = vmo.props[ vmo.firstColumnName ].oldValue;
                isRemovedValue = true;
            }
        }

        //check for added value
        var nameOfActionColumn = 'action';
        if( vmo.props[ nameOfActionColumn ].dbValues[0] === 'AddedExisting' ||
         vmo.props[ nameOfActionColumn ].dbValues[0] === 'Replace_Existing' ) {
            vmo.isAddedValue = true;
        }

        //check for added new value
        if( vmo.props[ nameOfActionColumn ].dbValues[0] === 'Add' ||
        vmo.props[ nameOfActionColumn ].dbValues[0] === 'Replace_New' || vmo.props[ nameOfActionColumn ].dbValues[0] === 'New' ) {
            vmo.isAddedNewValue = true;
        }

        // Check for empty action value
        if( vmo.props[ nameOfActionColumn ].dbValues[0] === ' ' ) {
            vmo.isEmptyActionValue = true;
        }

        var cellContent = tableSvc.createElement( column, vmo, tableElem );

        // Add markup class if value is removed
        if( isRemovedValue === true ) {
            var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
            if( cellText ) {
                cellText.classList.add( 'aw-jswidgets-oldText' );
            }
        }

        // Add markup class if value is added
        if( vmo.isAddedValue === true ) {
            var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
            if( cellText ) {
                cellText.classList.add( 'aw-change-addedEntry' );
            }
        }

        // Add markup class if value is Added New
        if( vmo.isAddedNewValue === true ) {
            var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
            if( cellText ) {
                cellText.classList.add( 'aw-change-addedEntry' );
            }
        }

        // Add row and cell coloring if is odd
        if( vmo.isOdd ) {
            cellContent.classList.add( 'aw-change-changeSummaryTableOddCell' );
            rowElem.classList.add( 'aw-change-changeSummaryTableOddRow' );
        }

        //Start Supersedure group Element Column
        if( vmo.supersedure_begin && !isPreviousRowBottomBorder ) {
            rowElem.classList.add( 'aw-change-changeSummaryTableTopBorder' );
            isSupersedure = true;
        }

        //Start Supersedure group Element Column
        if( vmo.supersedure_end ) {
            rowElem.classList.add( 'aw-change-changeSummaryTableBottomBorder' );
            isPreviousRowBottomBorder = true;
        }

        if( isSupersedure && vmo.props.action.commonInternalValues[0] !== 'Replace' && vmo.props.action.commonInternalValues[0] !== 'Replace_New' ) {
            isPreviousRowBottomBorder = false;
            isSupersedure = false;
        }

        return _addExtendedTooltip( cellContent, column, vmo, tableElem );
    },
    condition: function( column, vmo, tableElem, rowElem ) {
        return column.isTreeNavigation === true;
    }
};

/**
  * Table Cell Renderer for PL Table
  */
var _cellRenderer = function() {
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            var cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
            // Add row and cell coloring if is odd
            if( vmo.isOdd ) {
                cellContent.classList.add( 'aw-change-changeSummaryTableOddCell' );
                rowElem.classList.add( 'aw-change-changeSummaryTableOddRow' );
            }

            //Start Supersedure group Element Cell
            if( vmo.supersedure_begin && !isPreviousRowBottomBorder ) {
                rowElem.classList.add( 'aw-change-changeSummaryTableTopBorder' );
                isSupersedure = true;
            }

            if( vmo.supersedure_end ) {
                rowElem.classList.add( 'aw-change-changeSummaryTableBottomBorder' );
                isPreviousRowBottomBorder = true;
            }

            if( isSupersedure && vmo.props.action.commonInternalValues[0] !== 'Replace' && vmo.props.action.commonInternalValues[0] !== 'Replace_New' ) {
                isPreviousRowBottomBorder = false;
                isSupersedure = false;
            }

            // Remove row and cell coloring if is action value is empty
            if( vmo.isEmptyActionValue ) {
                var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
                if( cellText ) {
                    cellText.classList.remove( 'aw-jswidgets-change' );
                }
            }

            // Add red text class if change cell
            if( vmo.props[ column.name ].isChangeCell === true ) {
                var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
                if( cellText ) {
                    cellText.classList.add( 'aw-change-removedEntry' );
                }
            }

            // Add markup class if value is added
            if( vmo.isAddedValue ) {
                var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
                if( cellText ) {
                    cellText.classList.add( 'aw-change-addedEntry' );
                }
            }

            // Add markup class if value is added New
            if( vmo.isAddedNewValue ) {
                var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
                if( cellText ) {
                    cellText.classList.add( 'aw-change-addedEntry' );
                    if( column.field === 'action' && ( vmo.props.action.dbValues[0] === 'Add' ||
                     vmo.props.action.dbValues[0] === 'Replace_New' ) ) {
                        cellText.innerHTML += '<span class="aw-change-changeSummaryTableDot"></span>';
                    }
                }
            }
            // Add compare button if is compare
            if( column.isCompareColumn && vmo.isCompareRow ) {
                let compareIconElement = includeComponent( 'Cm1ChangeSummaryCompareIcon', {} );
                let renderedElement = document.createElement( 'div' );

                let appendCompareIconElement = function( cellContent ) {
                    if ( renderedElement ) {
                        localeSvc.getLocalizedText( 'ChangeMessages', 'compareTitle' ).then( function( result ) {
                            renderedElement.title = result;
                        } );
                        renderedElement.onclick = function( event ) {
                            event.preventDefault();
                            event.stopPropagation();
                            var primaryObjectUid = vmo.primaryObjectUid;
                            var secondaryObjectUid = vmo.secondaryObjectUid;
                            if( primaryObjectUid !== '' && secondaryObjectUid !== '' ) {
                                var targetObject = cdm.getObject( primaryObjectUid );
                                var sourceObject = cdm.getObject( secondaryObjectUid );

                                var mSelected = [];
                                mSelected.push( sourceObject );
                                mSelected.push( targetObject );

                                appCtxSvc.updatePartialCtx( 'mselected', mSelected );
                                compareSvc.launchContentCompare();
                            }
                        };

                        var iconWrapper = document.createElement( 'div' );
                        iconWrapper.className = 'ui-grid-tree-base-row-header-buttons ui-grid-tree-base-header';
                        iconWrapper.appendChild( renderedElement );
                        cellContent.appendChild( iconWrapper );
                    }
                };

                let appendCompareIconElementCallBack = function() {
                    setTimeout( function() { appendCompareIconElement( cellContent ); }, 100 );
                };
                if( renderedElement ) {
                    renderComponent( compareIconElement, renderedElement, appendCompareIconElementCallBack );
                }
            }
            //Get the required indicator if the column is merge
            if( column.name === 'mergeStatus' && vmo.props.mergeStatus.dbValues ) {
                appCtxSvc.registerCtx( 'isMergeCommandVisible', true );
                var iconWrapper = document.createElement( 'div' );
                if( vmo.props.mergeStatus.dbValues.length === 1 ) {
                    iconWrapper.className = 'ui-grid-tree-base-row-header-buttons ui-grid-tree-base-header aw-commands-mergeStatusSingleForChangeSummary';
                } else {
                    iconWrapper.className = 'aw-commands-mergeStatusMultipleValuesForChangeSummary';
                }
                for( let index = 0; index < vmo.props.mergeStatus.dbValues.length; index++ ) {
                    //Get merge status value and source a5ssembly
                    var mergeStatusValue = vmo.props.mergeStatus.displayValues[index];
                    var mergeStatusSourceAssembly = vmo.props.mergeStatus.dbValues[index];
                    //Get icon element for mergeStatus
                    setIconElementForMergeStatus( mergeStatusValue, mergeStatusSourceAssembly, vmo, tableElem, iconWrapper, cellContent );
                }
            }

            return _addExtendedTooltip( cellContent, column, vmo, tableElem );
        },
        condition: function( column, vmo, tableElem, rowElem ) {
            return true;
        }
    };
};

/**
  * Build column information for change summary table based on response from SOA getChangeSummaryData
  *
  * @param {ChangeSummaryTableColumnConfig} columnConfig - Column config returned by SOA
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  *
  */
export let initColumnsForChangeSummaryTable = function( columnConfig, dataProvider ) {
    // Build AW Columns
    var awColumnInfos = [];
    for( var index = 0; index < columnConfig.length; index++ ) {
        var firstColumn = false;
        var enableColumnMenu = true;

        // For first column we do not show column menu as freeze option is not valid for first column and that's the only menu item we have.
        let renderer = _cellRenderer();
        if( index === 0 ) {
            firstColumn = true;
            enableColumnMenu = false;
            renderer = _treeCellRenderer;
        }

        var columnInfo = {
            name: columnConfig[ index ].columnInternalName,
            propertyName: columnConfig[ index ].columnInternalName,
            displayName: columnConfig[ index ].columndisplayName,
            typeName: columnConfig[ index ].sourceTypeName,
            pixelWidth: columnConfig[ index ].pixelWidth,
            hiddenFlag: columnConfig[ index ].hiddenFlag,
            isCompareColumn: columnConfig[ index ].isCompareColumn,
            pinnedRight: false,
            enablePinning: false,
            firstColumn: firstColumn,
            enableColumnMenu: enableColumnMenu,
            cellRenderers: [ renderer ]
        };
        var awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );
        awColumnInfos.push( awColumnInfo );
    }

    // Set columnConfig to Data Provider.
    dataProvider.columnConfig = {
        columns: awColumnInfos
    };
};

/**
  * Handle Update of table data
  *
  *
  * @param {UwDataProvider} summaryTableDataProvider - The data provider for Change Summary Table.
  * @param {eventData } eventData - Event data when object is updated.
  *
  */
export let handleModelObjectUpdated = function( summaryTableDataProvider, eventData ) {
    if( summaryTableDataProvider && eventData ) {
        var viewModelCollection = summaryTableDataProvider.viewModelCollection;
        eventData.updatedObjects.forEach( function( modelObject ) {
            if( modelObject.uid ) {
                var allViewModelObjectsForTable = findAllViewModelObjects( viewModelCollection, modelObject.uid );
                if( allViewModelObjectsForTable.length > 0 ) {
                    allViewModelObjectsForTable.forEach( function( vmoFromTable ) {
                        summaryTableDataProvider.cols.forEach( function( column ) {
                            var columnName = column.name;
                            if( vmoFromTable.props[ columnName ] !== undefined && modelObject.props[ columnName ] !== undefined ) {
                                if( vmoFromTable.props[ columnName ].currentValue !== '' ) {
                                    vmoFromTable.props[ columnName ].currentValue = modelObject.props[ columnName ].uiValues[ 0 ];
                                    vmoFromTable.props[ columnName ].uiValue = modelObject.props[ columnName ].uiValues[ 0 ];
                                } else {
                                    vmoFromTable.props[ columnName ].oldValue = modelObject.props[ columnName ].uiValues[ 0 ];
                                }
                            }
                        } );
                    } );
                }
            }
        } );
    }
};

/**
  * Returns viewModel objects from dataProvider ViewModelCollection
  *
  * @param {viewModelCollection} viewModelCollection - viewModelcollection of DataProvider.
  * @param {String} idToFind - The ID (or UID) of the ViewModelObject to find.
  * @return {Array} matchedObjects - ViewModelObjects matched for Uid

  */
function findAllViewModelObjects( viewModelCollection, idToFind ) {
    var matchedObjects = [];
    if( viewModelCollection.loadedVMObjects ) {
        for( var ndx = 0; ndx < viewModelCollection.loadedVMObjects.length; ndx++ ) {
            var vmo = viewModelCollection.loadedVMObjects[ ndx ];

            if( vmo.uid && vmo.uid === idToFind ) {
                matchedObjects.push( vmo );
                continue;
            }

            if( vmo.id && vmo.id === idToFind ) {
                matchedObjects.push( vmo );
            }
        }
    }
    return matchedObjects;
}

/**
  * Saved Column configuration
  *
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  * @param {UwDataProvider} newColumns - Modified column information.
  *
  * @return {SearchResult} Search Result - In case of Change Summary Table this will be empty.
  */
export let saveColumnConfig = function( dataProvider, newColumns ) {
    var updatedColumnNames = [];
    var updatedColumnWidth = [];
    newColumns.forEach( function( newColumn ) {
        var isPropHidden = newColumn.hiddenFlag;
        var propName = newColumn.propertyName;
        if( isPropHidden ) {
            updatedColumnNames.push( propName + ',' + 'hidden' );
        } else {
            updatedColumnNames.push( propName + ',' + 'visible' );
        }

        if( newColumn.pixelWidth ) {
            updatedColumnWidth.push( newColumn.pixelWidth.toString() );
        }
    } );

    var prefNamesToUpdate = [ 'ChangeSummaryColumnsShownPref', 'ChangeSummaryColumnsShownWidthPref' ];
    var prefValuesToUpdate = [ updatedColumnNames, updatedColumnWidth ];

    preferenceService.setStringValues( prefNamesToUpdate, prefValuesToUpdate );

    return {
        search: ''
    };
};

/**
  * Reset Column configuration
  *
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  *
  */
export let resetColumnConfig = function( dataProvider ) {
    //Set default columns for Change Summary Table
    exports.initColumnsForChangeSummaryTable( dataProvider.defaultColumnConfig, dataProvider );

    //Set User's preference with default values.
    var updatedColumnNames = [];
    dataProvider.defaultColumnConfig.forEach( function( column ) {
        var propName = column.columnInternalName;
        updatedColumnNames.push( propName + ',' + 'visible' );
    } );

    preferenceService.setStringValue( 'ChangeSummaryColumnsShownPref', updatedColumnNames );
    var columnConfigurations = [ {
        columnConfigurations: [ {
            columns: dataProvider.columnConfig.columns
        } ]
    } ];

    return {
        columnConfigurations: columnConfigurations
    };
};

export let handleSelectionInChangeSummaryTable = function( selectedObjectFromChangeSummary ) {
    var propToLoad = [ 'object_string' ];
    var allObjectUid = [];

    var selectedObjects = getModelObjectsFromUID( selectedObjectFromChangeSummary );
    for( var i = 0; i < selectedObjects.length; i++ ) {
        allObjectUid.push( selectedObjects[ i ].uid );
    }
    var deferred = AwPromiseService.instance.defer();
    dmSvc.getProperties( allObjectUid, propToLoad ).then(
        function() {
            selectedObjects.forEach( function( vmoFromTable ) {
                var vmo = cdm.getObject( vmoFromTable.uid );
                if( vmo !== undefined && vmo.props.hasOwnProperty( 'object_string' ) ) {
                    vmoFromTable.props.object_string = vmo.props.object_string;
                }
            } );
            deferred.resolve( selectedObjects );
            return deferred.promise;
        } );
};

export let setViewerContext = function() {
    var ctx = {
        //vmo: $scope.contextObject,
        commands: {
            fullViewMode: {
                visible: true
            }
        }
    };

    if( appCtxSvc.getCtx( 'fullscreen' ) === true ) {
        ctx.commands.fullViewMode.visible = false;
    }
    appCtxSvc.registerCtx( 'viewerContext', ctx );
};

export let setChangeSummaryTableToolTipWidth = function() {
    //setting width of balloon pop up
    // eslint-disable-next-line no-undef
    var tooltipElement = $( 'body' ).find( 'aw-include[name=Cm1ChangeSummaryTooltip]' );
    if( tooltipElement && tooltipElement[0] ) {
        var popUpElement = tooltipElement[0].getElementsByClassName( 'aw-layout-include aw-layout-flexbox ng-scope' );

        if( popUpElement && popUpElement.length > 0 ) {
            popUpElement[popUpElement.length - 1].style.maxWidth = '110px';
            popUpElement[popUpElement.length - 1].style.maxHeight = '45px';
            popUpElement[popUpElement.length - 1].style.overflow = 'auto';
        }
    }
};
/**
  * get Model Objects for 'compareCandidates' UID array
  * of selected object in Change Summary.
  * Compare Candidate Objects are list of objects to be compared
  * in Property Compare table
  * @param {*} objects
  */
export let getModelObjectsFromUID = function( objects ) {
    let modelObjects = [];
    if ( objects.length === 1 && objects[0].compareCandidates !== undefined ) {
        objects[0].compareCandidates.map( function( compareNodeUID ) {
            modelObjects.push( cdm.getObject( compareNodeUID ) );
        } );

        return modelObjects;
    }
    return modelObjects;
};
/**
  * Validates if Property Compare table is loading based on
  * exist-when clause in View file (i.e. when table did not existed before)
  * or the table will reload (reload is valid only when table is already existing
  * and view model objects gets updated)
  *
  * This method takes care of reloading column configuration also if object type
  * of selection in Change Summary changes and it is a reload case for table reload.
  *
  * @param {*} data
  * @param {*} selectedObj
  */
export let validatePropertyCompareTableReload = function( data, selectedObj ) {
    //Registering here nextCompareTableCanReload from losing value while generating tree nodes (Tree command).
    //Previously present in processGetChangeSummaryDataResponse due to which nextCompareTableCanReload value reset after tree command in change summary table.
    //refer LCS-719313.
    if( !appCtxSvc.ctx.nextCompareTableCanReload ) {
        appCtxSvc.registerCtx( 'nextCompareTableCanReload', false ); // setting nextCompareTableCanReload to false for first time Compare table load.
    }
    data.isReloadValid.dbValue = appCtxSvc.ctx.nextCompareTableCanReload;

    if ( data.isReloadValid.dbValue === true && selectedObj.length === 1 && ( selectedObj[0].props.action.dbValues[0] === 'Modify' || selectedObj[0].props.action.dbValues[0] === 'Replace_New'
         || selectedObj[0].props.action.dbValues[0] === 'Replace_Existing' || selectedObj[0].compareCandidates !== undefined && selectedObj[0].compareCandidates.primaryAction === 'Replace' ) ) {
        if ( isObjectTypeDifferentForCompare( selectedObj ) ) {
            data.isObjTypeDifferent.dbValue = true;
            eventBus.publish( 'propertyCompareGrid.columnConfiguration.reload' );
        } else {
            data.isObjTypeDifferent.dbValue = false;
            eventBus.publish( 'propertyCompareGrid.plTable.reload' );
        }
    }
    // if invalid condition for Compare, table will not exist and hence else block reload validation is false,
    // for table load to get in only exist-when case
    else {
        appCtxSvc.updatePartialCtx( 'nextCompareTableCanReload', false );
    }
};
/**
  * This method checks the object type of all the comparing
  * modelObjects , to reload Column configuration if object types
  * of objects being compared are different
  * @param {*} currentObject
  */
function isObjectTypeDifferentForCompare( currentObject ) {
    let modelObjects = getModelObjectsFromUID( currentObject );

    let objTypes = [];
    modelObjects.map( function( modelObj ) {
        if ( modelObj !== null && ( objTypes.length === 0 || objTypes.indexOf( modelObj.type ) === -1 ) ) {
            objTypes.push( modelObj.type );
        }
    } );

    let prevObjTypes = appCtxSvc.ctx.prevSelectedObjectType;
    if ( objTypes.length !== prevObjTypes.length ) {
        return true;
    }
    for ( var idx in objTypes ) {
        if ( prevObjTypes !== undefined && prevObjTypes !== null && prevObjTypes.indexOf( objTypes[idx] ) === -1 ) {
            return true;
        }
    }
    return false;
}

/**
  * This method makes a SOA call to get column configuration.
  * SOA input includes model objects(and its object type) to be compared ,
  * for which column configuration will be returned.
  * @param {*} serviceName
  * @param {*} operationName
  * @param {*} soaInput
  * @param {*} modelObjects
  * @param {*} columnProvider
  */
export let getPropertyCompareTableColumnConfig = function( serviceName, operationName, soaInput, modelObjects, columnProvider ) {
    let types = [];
    modelObjects.map( function( modelObj ) {
        if ( modelObj !== null && ( types.length === 0 || types.indexOf( modelObj.type ) === -1 ) ) {
            types.push( modelObj.type );
        }
    } );
    columnProvider.types = types;
    var colConfigInput = soaInput.getOrResetUiConfigsIn[0];
    colConfigInput.businessObjects = modelObjects;
    colConfigInput.columnConfigQueryInfos[0].typeNames = types;
    return soaSvc.postUnchecked( serviceName, operationName, soaInput ).then( function( result ) {
        result.types = types;
        //for validating table reload
        appCtxSvc.updatePartialCtx( 'nextCompareTableCanReload', true );
        return result;
    } );
};
/**
  * For the ModelObjects to be compared ,this method creates viewModelObjects
  * and populates it viewModelProperties to be displayed in Property Compare Table
  * @param {*} modelObjects
  * @param {*} columns
  * @param {*} selObj
  */
export let getPropertyCompareTableVMOs = function( modelObjects, columns ) {
    if ( !columns ) {
        return new Promise( ( resolve ) => {
            resolve( {
                searchResults: [],
                totalFound: 0
            } );
        } );
    }
    // stores object type of selection, to be used if selection change object type is different
    let types = [];
    modelObjects.map( function( modelObj ) {
        if ( modelObj !== null && ( types.length === 0 || types.indexOf( modelObj.type ) === -1 ) ) {
            types.push( modelObj.type );
        }
    } );
    appCtxSvc.updatePartialCtx( 'prevSelectedObjectType', types );
    var propNames = columns.map( function( col ) {
        return col.propertyName || col.propDescriptor.propertyName;
    } );

    var viewModelObjects = modelObjects.map( function( modelObject ) {
        let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( modelObject );
        vmo.displayName = vmo.props.object_string ? vmo.props.object_string.uiValues[0] : vmo.props.object_name ? vmo.props.object_name.uiValues[0] : '';
        return vmo;
    } );

    /**
     * Due to the classification speficic code PLM565540 being added only to getViewModelProperties SOA but not to getViewModelProperties2 SOA,
     * cannot replace this case to use the new getViewModelProperties2 SOA.
     */
    return tcViewModelObjectService.getViewModelPropertiesDeprecated( viewModelObjects, propNames ).then( function( result ) {
        if ( result && result.output && result.output.objects ) {
            awCompare.putClsData( viewModelObjects, result.output.objects );
        }
        return {
            searchResults: viewModelObjects,
            totalFound: viewModelObjects.length
        };
    } );
};
/**
  * arrangeColumn method is different for Change Summary table &
  * for Property Compare table with different inputs
  * Selecting here the appropriate action for arrange column ,based on eventdata
  * @param {*} eventData
  */
export let selectArrangeEventAction = function( eventData ) {
    if ( eventData !== undefined && eventData !== null && eventData.name === 'propertyCompareGrid' ) {
        eventBus.publish( 'doArrangeCompareEvent' );
    } else {
        eventBus.publish( 'doArrangeEvent' );
    }
};

/**
  * This function returns the icon element for merge status
  * @param {*} mergeStatusValue
  * @param {*} mergeStatusSourceAssembly
  * @param {*} tableElem
  */
export let setIconElementForMergeStatus = function( mergeStatusValue, mergeStatusSourceAssembly, vmo, tableElem, iconWrapper, cellContent ) {
    if( mergeStatusValue === 'Required' ) {
        //If merge status is required, then we need to show source assembly name along with status value.
        let mergeRequiredElement = includeComponent( 'Cm1ChangeSummaryIndicatorMergeRequired', {} );
        let renderedElement = document.createElement( 'div' );
        renderedElement.className = 'aw-commands-mergeStatusIconForChangeSummary';
        let appendIndicatorMergeRequiredElement = function() {
            if ( renderedElement ) {
                var sourceAssemblyUid;
                localeSvc.getLocalizedText( 'ChangeMessages', 'mergeRequired' ).then( function( result ) {
                    sourceAssemblyUid = mergeStatusSourceAssembly;
                    //Source assembly might not be loaded so load it
                    var objectsToLoadUid = [ sourceAssemblyUid ];
                    var promiseLoadObject = dmSvc.loadObjects( objectsToLoadUid );
                    promiseLoadObject.then( function() {
                        var sourceVmo = cdm.getObject( objectsToLoadUid[0] );
                        var sourceAssemblyName = '';
                        if( sourceVmo !== undefined && sourceVmo.props.hasOwnProperty( 'object_string' ) ) {
                            sourceAssemblyName = sourceVmo.props.object_string.dbValues[0];
                        }
                        renderedElement.title = result.replace( '{0}', sourceAssemblyName );
                        renderedElement.className = 'aw-commands-mergeStatusIconForChangeSummary';
                    } );
                    renderedElement.onclick = function( event ) {
                        event.preventDefault();
                        event.stopPropagation();
                        var sourceUid = sourceAssemblyUid;
                        var targetUid = vmo.primaryObjectUid;
                        if( sourceUid !== '' && targetUid !== '' ) {
                            var targetObject = cdm.getObject( targetUid );
                            var sourceObject = cdm.getObject( sourceUid );

                            var sourceTargetObjects = [];
                            sourceTargetObjects.push( sourceObject );
                            sourceTargetObjects.push( targetObject );

                            appCtxSvc.updatePartialCtx( 'mselected', sourceTargetObjects );
                            var requestPrefValue = {
                                dataFilterMode: 'compare',
                                showChange:  [ 'true' ]
                            };
                            appCtxSvc.updatePartialCtx( 'requestPref', requestPrefValue );
                            launchMergeSplitView();
                        }
                    };
                    iconWrapper.appendChild( renderedElement );
                    cellContent.appendChild( iconWrapper );
                } );
            }
        };

        let appendIndicatorMergeRequiredElementCallBack = function() {
            setTimeout( function() { appendIndicatorMergeRequiredElement(); }, 100 );
        };

        if( renderedElement ) {
            renderComponent( mergeRequiredElement, renderedElement, appendIndicatorMergeRequiredElementCallBack );
        }
    } else if( mergeStatusValue === 'Complete' ) {
        let indicatorMergeCompleteElement = includeComponent( 'Cm1ChangeSummaryIndicatorMergeComplete', {} );
        let renderedElement = document.createElement( 'div' );
        let appendIndicatorMergeCompleteElement = function() {
            if ( renderedElement ) {
                var sourceAssemblyUid;
                localeSvc.getLocalizedText( 'ChangeMessages', 'mergeComplete' ).then( function( result ) {
                    sourceAssemblyUid = mergeStatusSourceAssembly;
                    //Source assembly might not be loaded so load it
                    var objectsToLoadUid = [ sourceAssemblyUid ];
                    var promiseLoadObject = dmSvc.loadObjects( objectsToLoadUid );
                    promiseLoadObject.then( function() {
                        var sourceVmo = cdm.getObject( objectsToLoadUid[0] );
                        var sourceAssemblyName = '';
                        if( sourceVmo !== undefined && sourceVmo.props.hasOwnProperty( 'object_string' ) ) {
                            sourceAssemblyName = sourceVmo.props.object_string.dbValues[0];
                        }
                        renderedElement.title = result.replace( '{0}', sourceAssemblyName );
                        renderedElement.className = 'aw-commands-mergeStatusIconForChangeSummary';
                    } );
                } );
                renderedElement.onclick = function( event ) {
                    event.preventDefault();
                    event.stopPropagation();
                    var sourceUid = sourceAssemblyUid;
                    var targetUid = vmo.primaryObjectUid;
                    if( sourceUid !== '' && targetUid !== '' ) {
                        var targetObject = cdm.getObject( targetUid );
                        var sourceObject = cdm.getObject( sourceUid );

                        var sourceTargetObjects = [];
                        sourceTargetObjects.push( sourceObject );
                        sourceTargetObjects.push( targetObject );

                        appCtxSvc.updatePartialCtx( 'mselected', sourceTargetObjects );
                        var requestPrefValue = {
                            dataFilterMode: 'compare',
                            showChange:  [ 'true' ]
                        };
                        appCtxSvc.updatePartialCtx( 'requestPref', requestPrefValue );
                        launchMergeSplitView();
                    }
                };
                iconWrapper.appendChild( renderedElement );
                cellContent.appendChild( iconWrapper );
            }
        };

        let appendIndicatorMergeCompleteElementCallBack = function() {
            setTimeout( function() { appendIndicatorMergeCompleteElement(); }, 100 );
        };

        if( renderedElement ) {
            renderComponent( indicatorMergeCompleteElement, renderedElement, appendIndicatorMergeCompleteElementCallBack );
        }
    }
};

/*
 * Change summary column header renderer
 * Custom Header renderer is required because for merge status column we need to show icon instead of column name
 */
export let changeSummaryTableHeaderRender = function( containerElement, columnField, tooltip, column ) {
    var headerContent = document.createElement( 'div' );
    // Add column header label

    var labelFilter = document.createElement( 'div' );
    labelFilter.textContent = column.displayName;
    headerContent.appendChild( labelFilter );


    containerElement.appendChild( headerContent );
};

/*
 * Launch Merge Split View
 */
export let launchMergeSplitView = function() {
    var toParams = {};
    //Store Change Notice Object so that user return back to same Change Notice Object after closing Merge.
    var mergeChangeNoticeObject = appCtxSvc.ctx.xrtSummaryContextObject.uid;
    toParams.ecn_uid = mergeChangeNoticeObject;
    toParams.uid = appCtxSvc.ctx.mselected[0].uid;
    toParams.uid2 = appCtxSvc.ctx.mselected[1].uid;
    toParams.pci_uid = occmgmtUtils.getProductContextForProvidedObject( appCtxSvc.ctx.mselected[ 0 ] );
    toParams.pci_uid2 = occmgmtUtils.getProductContextForProvidedObject( appCtxSvc.ctx.mselected[ 1 ] );
    var transitionTo = 'mergeChanges';
    LocationNavigationService.instance.go( transitionTo, toParams );
};

/*
 * Resetting startIndexForNextPage property
 */
export let resetDataProviderStartIndex = function( dataProvider ) {
    dataProvider.startIndexForNextPage = 0;
};

/**
  * This is the primary service for change summary table
  *
  * @param {$q} $q - Service to use.
  * @param {appCtxService} appCtxSvc - Service to use.
  * @param {awColumnService} awColumnSvc - Service to use.
  * @param {awTableService} awTableSvc - Service to use.
  * @param {soa_dataManagementService} dmSvc - Service to use.
  * @param {soa_kernel_clientDataModel} cdm - Service to use.
  * @param {propPolicySvc} propPolicySvc - Service to use.
  * @param {soa_kernel_soaService} soaSvc - Service to use.
  * @param {uwPropertyService} uwPropertyService - Service to use.
  * @param {viewModelObjectService} viewModelObjectService - Service to use.
  *
  * @returns {Cm1ChangeSummaryService} Instance of the service API object.
  */

export default exports = {
    getChangeSummaryData,
    loadInitialColumns,
    initColumnsForChangeSummaryTable,
    handleModelObjectUpdated,
    saveColumnConfig,
    resetColumnConfig,
    handleSelectionInChangeSummaryTable,
    setViewerContext,
    setChangeSummaryTableToolTipWidth,
    getModelObjectsFromUID,
    getPropertyCompareTableColumnConfig,
    getPropertyCompareTableVMOs,
    validatePropertyCompareTableReload,
    selectArrangeEventAction,
    setIconElementForMergeStatus,
    changeSummaryTableHeaderRender,
    launchMergeSplitView,
    resetDataProviderStartIndex
};
