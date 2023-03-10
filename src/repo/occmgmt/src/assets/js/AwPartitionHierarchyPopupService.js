// Copyright (c) 2022 Siemens

/**
 * A service that manages the 4G specific sections displayed in the ACE configuration panel.<br>
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 *
 */
import eventBus from 'js/eventBus';
import _ from 'lodash';
import soaService from 'soa/kernel/soaService';
import occmgmtGetSvc from 'js/occmgmtGetService';
import occmgmtUtils from 'js/occmgmtUtils';
import occmgmtViewModelTreeNodeCreateService from 'js/occmgmtViewModelTreeNodeCreateService';
import cdm from 'soa/kernel/clientDataModel';
import AwPromiseService from 'js/awPromiseService';
import awTableSvc from 'js/awTableService';
import tcVmoService from 'js/tcViewModelObjectService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';

var exports = {};

/**
 * The Action method for the Tree Data Provider. If there is a search string in the search box,
 * then the list of Partitions are obtained using SOA findMatchingFilters2. Otherwise it would
 * get the Partitions using getOccurrences3 SOA.
 * *
 * @param {Object} data - Input data object from the view model
 * @param {Object} partitionSchemeObject - Partition Scheme for which Popup is opened
 * @param {Object} recipe - current recipe of subset
 * @returns {Object} Tree Load Result.
 */
export let getPartitionHierarchy = function( data, partitionSchemeObject, recipe ) {
    //data.partitionSchemeObject = partitionSchemeObject;
    data.recipe = '';
    let schemeUid = 'AAAAAAAAAAAAAA';
    if( data.treeLoadInput.parentNode.uid === 'top' ) {
        schemeUid = partitionSchemeObject.internalName;
    }
    let occurrenceScheme = {
        type : 'unKnownType',
        uid : schemeUid
    };

    if( data.searchBox && data.searchBox !== undefined && data.searchBox.dbValue === '' ) {
        // If the state is Search, this means search was performed before and hence we need to clean up the variables.
        // Mode switched from 'Search' to 'Load' tree.
        if ( data.state.dbValue === 'search' ) {
            // Reset variables
            data.searchVMNodes = [];
            data.newlySelectedPartitions = [];
            data.unSelectedPartitions = [];
            data.prevSelectedPartitions = [];
        }

        // Call getOccurrences3 SOA to get the initial list of Partitions.
        const requestPref = {
            displayMode: [ 'Tree' ],
            showPartitionHierarchy: [ 'true', partitionSchemeObject.internalName ],
            savedSessionMode: [ 'ignore' ]
        };

        let soaInput = occmgmtGetSvc.getDefaultSoaInput();
        let inputData = soaInput.inputData;
        inputData.config.productContext = getProductContext( data, recipe );
        // inputData.config.productContext = occmgmtUtils.getProductContextForProvidedObject( recipe.occContext.rootElement.modelObject );
        inputData.config.occurrenceScheme = occurrenceScheme;
        inputData.requestPref = requestPref;
        var temp2 = {
            type : 'unKnownType',
            uid : recipe.occContext.rootElement.props.awb0UnderlyingObject.dbValues[0]
        };
        inputData.product = temp2;
        //inputData.product = occmgmtUtils.getObject( temp );
        //inputData.parentElement = getParentUid( data );
        inputData.parentElement = getParentUid( data, recipe );

        return soaService.postUnchecked( 'Internal-ActiveWorkspaceBom-2019-12-OccurrenceManagement', 'getOccurrences3', soaInput ).then(
            function( response ) {
                var treeLoadResult = buildTree( response, data );
                return {
                    parentNode: treeLoadResult.parentNode,
                    childNodes: treeLoadResult.childNodes,
                    totalChildCount: treeLoadResult.totalChildCount,
                    startChildNdx: 0,
                    treeLoadResult: treeLoadResult,
                    productContext: treeLoadResult.productContext
                };
            } );
    }

    let totalVmos = data.dataProviders.partitionDataProvider.viewModelCollection.getLoadedViewModelObjects();
    data.dataProviders.partitionDataProvider.viewModelCollection.removeLoadedObjects( totalVmos );
    data.dataProviders.partitionDataProvider.viewModelCollection.update( data.treeLoadResult.childNodes, data.treeLoadResult.totalChildCount );
    eventBus.publish( 'searchResultFlatList.Loaded' );

    return {
        parentNode: data.treeLoadResult.parentNode,
        childNodes: data.treeLoadResult.childNodes,
        totalChildCount: data.treeLoadResult.totalChildCount,
        startChildNdx: 0,
        treeLoadResult: data.treeLoadResult,
        productContext: data.productContextInfo,
        searchVMNodes: data.treeLoadResult.searchVMNodes
    };
};

/**
 * Build Tree based on the Search Results SOA Response.
 * @param {Object} response getOccurrences3 SOA Response
 * @param {Object} data  - Input data object from the view model.
 * @return {Object} - Tree Structure that includes Parent-Children View Model Tree Nodes.
 */
export function buildSearchResults( response, data ) {
    const searchFilterMap = response.filterOut[0].searchFilterMap;
    var matchedFilters = searchFilterMap[ data.partitionSchemeObject.internalName ];
    var newVMNodes = [];

    _.forEach( matchedFilters, function( filter ) {
        var vmNode = {
            displayName: filter.stringDisplayValue,
            uid: filter.stringValue,
            isLeaf: true,
            levelNdx: 0
        };
        newVMNodes.push( vmNode );
    } );

    var searchVMNodes = newVMNodes;

    //need to set is it a search or normal load method
    data.dispatch( { path: 'data.state.dbValue', value: 'search' } );

    return {
        parentNode: data.treeLoadInput.parentNode,
        childNodes: newVMNodes,
        totalChildCount: newVMNodes.length,
        startChildNdx: 0,
        searchVMNodes: searchVMNodes
    };
}

/**
 * Get Product Context.
 *
 * @param {Object} data - Input data object from the view model.
 * @return {object} - Product Context.
 */
export function getProductContext( data, recipe ) {
    let productContext = {
        type : 'Awb0ProductContextInfo',
        uid : 'AAAAAAAAAAAAAA'
    };
    if ( data.treeLoadInput.parentNode.uid === 'top' ) {
        productContext.uid = occmgmtUtils.getProductContextForProvidedObject( recipe.occContext.rootElement.modelType );
    } else {
        productContext.type = data.data.productContextInfo.type;
        productContext.uid = data.data.productContextInfo.uid;
    }
    return productContext;
}

/**
 * Get Parent UID.
 *
 * @param {Object} data - Input data object from the view model.
 * @return {object} - Parent UID.
 */
export function getParentUid( data, recipe ) {
    var parentElementUid;
    if ( data.treeLoadInput.parentNode.uid === 'top' ) {
        parentElementUid = recipe.occContext.rootElement.uid;
    } else{
        parentElementUid = data.treeLoadInput.parentNode.uid;
    }
    return parentElementUid;
}

/**
 * Build Tree based on the getOccurrences3 SOA Response.
 * @param {Object} response SOA Response
 * @param {Object} data  - Input data object from the view model.
 * @return {Object} - Tree Structure
 */
export function buildTree( response, data ) {
    const childParentInfo = [];
    var temp;
    if( response.parentChildrenInfos.length !== 0 ) {
        temp =  response.parentChildrenInfos[0].childrenInfo;
    } else {
        return{
            parentNode: [],
            childNodes: [],
            totalChildCount: 0,
            startChildNdx: 0,
            productContext: ''
        };
    }

    for( let inx = 0; inx < temp.length; inx++ ) {
        if( temp[inx].occurrenceId.includes( 'Fgf0PartitionElement' ) ) {
            childParentInfo.push( temp[inx] );
        }
    }
    if( childParentInfo.length === 0 ) {
        return{
            parentNode: [],
            childNodes: [],
            totalChildCount: 0,
            startChildNdx: 0,
            productContext: ''
        };
    }

    const childOccurenceInfos = childParentInfo;
    const childNdx = data.treeLoadInput.parentNode.levelNdx + 1;
    const parentUid = data.treeLoadInput.parentNode.uid;
    const pciUid = response.rootProductContext.uid;
    let productContext = response.rootProductContext;

    const elementToPciMap = null;
    var newVMNodes = occmgmtViewModelTreeNodeCreateService.createVMNodesForGivenOccurrences( childOccurenceInfos, childNdx, pciUid, elementToPciMap, parentUid );

    // As the user expands the parent partitions, add the child partitions to the list of existing VM Nodes.
    var vmNodes = {};
    if ( data.vmNodes.length > 0 ) {
        vmNodes = data.vmNodes;
        _.forEach( newVMNodes, function( newVMNode ) {
            vmNodes.push( newVMNode );
        } );
    } else {
        vmNodes = newVMNodes;
    }
    //need to set is it a search or normal load method
    data.dispatch( { path: 'data.state.dbValue', value: 'load' } );
    return {
        parentNode: data.treeLoadInput.parentNode,
        childNodes: vmNodes,
        totalChildCount: newVMNodes.length,
        startChildNdx: 0,
        productContext: productContext
    };
}

/**
 * Get the partition UID from the View Model Node provided.
 *
 * @param {Object} vmNode - View Model Tree Node
 */
export let getPartitionUIDFromNode = function( vmNode, data ) {
    // Get the Partition UID from vmNode
    let partitionUID = undefined;
    if ( !vmNode.id ) {
        partitionUID = vmNode.uid;
    } else {
        var clientObject = cdm.getObject( vmNode.id );
        if ( clientObject ) {
            partitionUID = clientObject.props.awb0UnderlyingObject.dbValues[0];
        }
    }
    return partitionUID;
};

/**
 * Loops through the tree nodes to find out which partitions are in the recipe already and marks those nodes as checked.
 *
 * @param {Object} data - Input data object from the view model
 */
export let checkPartitionsInRecipe = function( data, subPanelContext ) {
    let vmNodes;
    let schemeDisplayName = subPanelContext.sharedData.clickedObj.selected.label;

    if ( data.state.dbValue === 'load' ) {
        vmNodes = data.dataProviders.partitionDataProvider.viewModelCollection.loadedVMObjects;
    } else {
        vmNodes = data.searchVMNodes;
    }

    for( let i = 0; i < vmNodes.length; i++ ) {
        // For each Tree Node,get the partition UID and see if that Partition is in the recipe/ newly selected list/ unselected list.
        let vmNode = vmNodes[i];
        let isPartitionSelected = false;

        // Get the Partition UID from vmNode
        let partitionUID = getPartitionUIDFromNode( vmNode, data );

        if ( partitionUID ) {
            let operatorType = subPanelContext.sharedData.recipeOperator;
            let recipeTerms = subPanelContext.sharedData.recipeTermToAdd;
            let partitionInRecipe = undefined;

            // Loop through the recipe terms to see if this particular VMNode (Partition) is in the recipe.
            // If yes, then select the checkbox
            for( let j = 0; j < recipeTerms.length; j++ ) {
                let recipeTerm = recipeTerms[j];
                if ( recipeTerm.criteriaType === 'Partition' && recipeTerm.criteriaDisplayValue.includes( schemeDisplayName ) && recipeTerm.criteriaOperatorType === operatorType ) {
                    // Check if recipeTerm.criteriaValues has partitionUID. If yes, check the checkbox on the corresponding VMNode.
                    let criteriaValues = recipeTerm.criteriaValues;
                    partitionInRecipe = _.filter( criteriaValues, function( criteriaValue ) {
                        return criteriaValue === partitionUID;
                    } );
                    // If partition is in the list of criteria values, then check the partition.
                    if ( partitionInRecipe && partitionInRecipe.length > 0 ) {
                        isPartitionSelected = true;
                        data.dataProviders.partitionDataProvider.selectionModel.addToSelection( vmNode );
                        break;
                    }
                }
            }
            // Loop through the unSelected list and unselect them.
            let unSelectedNodes = data.unSelectedPartitions;
            if ( unSelectedNodes && unSelectedNodes.length > 0 ) {
                let partitionInUnSelectedNodes = _.filter( unSelectedNodes, function( unSelectedNode ) {
                    return unSelectedNode === vmNode;
                } );
                if ( partitionInUnSelectedNodes && partitionInUnSelectedNodes.length > 0 ) {
                    // Partition in Unselected list; so unselect this partition.
                    vmNode.selected = false;
                    data.dataProviders.partitionDataProvider.selectionModel.removeFromSelection( vmNode );
                }
            }

            // Loop through the Newly selected list and select them
            let selectedNodes = data.newlySelectedPartitions;
            if ( selectedNodes && selectedNodes.length > 0 ) {
                let partitionInSelectedNodes = _.filter( selectedNodes, function( selectedNode ) {
                    return selectedNode === vmNode;
                } );
                if ( partitionInSelectedNodes && partitionInSelectedNodes.length > 0 ) {
                    // Partition in selected list; so select this partition.
                    vmNode.selected = true;
                    data.dataProviders.partitionDataProvider.selectionModel.addToSelection( vmNode );
                }
                //check all newly selected partitions will be in selection
                for( let inx = 0; inx < selectedNodes.length; inx++ ) {
                    //let selectedNode = cdm.getObject( selectedNodes[inx] );
                    if( vmNode.stableId === selectedNodes[inx].stableId ) {
                        vmNode.selected = true;
                        isPartitionSelected = true;
                    }
                }
            }
            // unselect all the remaning nodes.
            if ( isPartitionSelected === false ) {
                data.dataProviders.partitionDataProvider.selectionModel.removeFromSelection( vmNode );
            }
        }
    }
    var selectedObj = data.dataProviders.partitionDataProvider.selectionModel.getSelection();
    data.dispatch( { path: 'data.selectedPartitions', value: selectedObj } );
};

/**
 * This function will Load the tree table properties.
 *
 @param {PropertyLoadRequestArray} propertyLoadRequests - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property
 *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
 *            properties on this object is used (if defined).
 * @returns {Promise} promise
 */
export let loadTreeTableProperties = function() {
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );
    if( propertyLoadInput ) {
        return exports.loadProperties( propertyLoadInput );
    }

    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};
/**
 * Loads properties based on the client scope URI.
 * @param {*} propertyLoadInput - An object that contains the requests for what properties to load.
 * @returns{Object} propertyLoadResult property load result
 */
export let loadProperties = function( propertyLoadInput ) {
    var allChildNodes = [];

    var propertyLoadContext = {
        clientName: 'AWClient',
        clientScopeURI: 'Awb0OccurrenceManagement',
        typesForArrange: [ ]
    };

    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            allChildNodes.push( childNode );
        } );
    } );

    var propertyLoadResult = awTableSvc.createPropertyLoadResult( allChildNodes );

    return tcVmoService.getTableViewModelProperties( allChildNodes, propertyLoadContext ).then(
        function( response ) {
            _.forEach( allChildNodes, function( childNode ) {
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm
                    .getObject( childNode.id ), 'EDIT' );
                _.forEach( vmo.props, function( vmProp ) {
                    childNode.props[ vmProp.propertyName ] = vmProp;
                } );
            } );
            if( response ) {
                propertyLoadResult.columnConfig = response.output.columnConfig;
                if( propertyLoadResult.columnConfig.columns.length === 0 ) {
                    let columns =
                        {
                            name: 'Awb0Element',
                            displayName : 'Element',
                            isTreeNavigation : true,
                            pinnedLeft: true,
                            enableColumnMenu : false,
                            enableColumnMoving : false
                        };

                    propertyLoadResult.columnConfig.columns = columns;
                }
            }

            return {
                propertyLoadResult: propertyLoadResult
            };
        } );
};


/**
 * When a partition is selected/un-selected, the partition is added to the Newly Selected List or UnSelected list respectively.
 *
 * @param {Object} data - Input data object from the view model
 * @param {Object} eventMap - Data from Event
 */
export let onPartitionSelection = function( data, eventMap ) {
    if( eventMap ) {
        let eventData = eventMap[ 'partitionHierarchyTreeTable.gridSelection' ];
        if( !eventData || !eventData.selectedObjects ) {
            return;
        }
        let selection = {
            newlySelectedPartitions: [],
            prevSelectedPartitions: [],
            unSelectedPartitions: []
        };
        let prevSelections = [];
        let curSelections = eventData.selectedObjects;

        if( typeof data.prevSelectedPartitions.length !== 'undefined' ) {
            prevSelections = data.prevSelectedPartitions;
        }
        selection.newlySelectedPartitions = data.newlySelectedPartitions;

        if ( curSelections.length > prevSelections.length ) {
            // Selected a new Partition.
            let newlySelectedPartition = eventData.selectedObjects[ eventData.selectedObjects.length - 1 ];

            // First check if the selected partition is in the unSelectedPartitions list ( unselect, select same partition scenario),
            // If present, then remove the partition from the unSelectedPartitions list.
            // If not present, then add the partition to the newlySelectedPartitions list

            let unSelectedPartitions = data.unSelectedPartitions;
            let deletedPartitionsInUnSelectedList = _.remove( unSelectedPartitions, function( unSelectedPartition ) {
                return unSelectedPartition === newlySelectedPartition;
            } );

            if ( deletedPartitionsInUnSelectedList && deletedPartitionsInUnSelectedList.length === 0  ) {
                // Partition not present in unSelectedPartitions list; Add the partition to the newlySelectedPartitions list
                if ( data.newlySelectedPartitions.length > 0 ) {
                    selection.newlySelectedPartitions.push( newlySelectedPartition );
                } else {
                    selection.newlySelectedPartitions = [ newlySelectedPartition ];
                }
            }
        } else{
            // Unselected a Partition.

            for( let i = 0; i < prevSelections.length; i++ ) {
                // Check if each before selection is present in the current selections
                let partitionInCurrentSelections = _.filter( curSelections, function( curSelection ) {
                    return curSelection === prevSelections[i];
                } );
                if ( partitionInCurrentSelections && partitionInCurrentSelections.length === 0 ) {
                    // Partition is not present in the current selections. That means it is unselected which means...
                    // 1. Partition needs to be removed from newlySelectedPartitions list ( select, unselect a new partition use case) or
                    // 2. Add the partition to the unselected list ( Unselected an existing partition in recipe )
                    if ( data.newlySelectedPartitions.length > 0 ) {
                        let deletedPartitionsInNewlySelectedList = _.remove( data.newlySelectedPartitions, function( newlySelectedPartition ) {
                            return newlySelectedPartition === prevSelections[i];
                        } );
                        if ( deletedPartitionsInNewlySelectedList && deletedPartitionsInNewlySelectedList.length > 0 ) {
                            // Deleted the partition from the New List; hence come out of the loop.
                            break;
                        }
                    }

                    // If Partition is not deleted from new list, then add the partition to the unselected list to be removed from recipe.
                    if ( data.unSelectedPartitions.length > 0 ) {
                        // Check if the partition is already present in the un-selected list before adding to the list
                        let partitionInList = _.filter( data.unSelectedPartitions, function( unSelectedPartition ) {
                            return unSelectedPartition === prevSelections[i];
                        } );
                        if ( partitionInList && partitionInList.length === 0 ) {
                            selection.unSelectedPartitions.push( prevSelections[i] );
                        }
                    } else {
                        selection.unSelectedPartitions = [ prevSelections[i] ];
                    }
                }
            }
        }
        // Save current selections as previous selections
        selection.prevSelectedPartitions = curSelections;
        return {
            newlySelectedPartitions: selection.newlySelectedPartitions,
            prevSelectedPartitions:  selection.prevSelectedPartitions,
            unSelectedPartitions:    selection.unSelectedPartitions
        };
    }
};

/**
 * This function will create a structure for holding SOA input for given partition scheme.
 *
 * @param {Object} partitionSchemeObject - Partition Scheme for which Popup is opened.
 * @return {object} - Search filter category object which holds SOA input.
 */
var createSearchFilterCategoryForSOA = function( partitionSchemeObject ) {
    var searchFilterCategory = {};
    searchFilterCategory.categoryType = 'Partition';
    searchFilterCategory.defaultFilterValueDisplayCount = 5;
    searchFilterCategory.displayName = partitionSchemeObject.displayName;
    searchFilterCategory.editable = true;
    searchFilterCategory.internalName = partitionSchemeObject.internalName;
    searchFilterCategory.isHierarchical = false;
    searchFilterCategory.isMultiSelect = false;
    searchFilterCategory.quickSearchable = false;
    return searchFilterCategory;
};

/**
 * This function will create a structure for holding SOA input filter map for given filter value.
 *
 * @param {Object} filter - filter value object.
 * @return {object} - Search filter map object which holds SOA input.
 */
var createSearchFilterMapForSOA = function( filter ) {
    var searchFilterMap = {};
    searchFilterMap.count = filter.count;
    searchFilterMap.endDateValue = filter.endDateValue;
    searchFilterMap.endNumericValue = filter.endNumericValue;
    searchFilterMap.hasChildren = false;
    searchFilterMap.searchFilterType = 'Partition';
    searchFilterMap.selected = true;
    searchFilterMap.startDateValue = filter.startDateValue;
    searchFilterMap.startEndRange = '';
    searchFilterMap.startNumericValue = filter.startNumericValue;
    searchFilterMap.stringDisplayValue = filter.stringDisplayValue;
    searchFilterMap.stringValue = filter.stringValue;
    return searchFilterMap;
};

/**
 * This function will create a filter object for the selected partition object.
 *
 * @param {Object} selObject - Partition Object.
 * @return {object} - Filter Object which holds SOA input.
 */
export let getFilterObject = function( selObject ) {
    var filter = {};

    if ( !selObject.id ) {
        filter.stringValue = selObject.uid;
    } else {
        var clientObject = cdm.getObject( selObject.id );
        filter.stringValue = clientObject.props.awb0UnderlyingObject.dbValues[0];
        filter.stringDisplayValue = selObject.displayName;
    }
    filter.count = 0;
    filter.endDateValue = '0001-01-01T00:00:00';
    filter.endNumericValue = 0;
    filter.hasChildren = false;
    filter.searchFilterType = 'Partition';
    filter.selected = true;
    filter.startDateValue = '0001-01-01T00:00:00';
    filter.startEndRange = '';
    filter.startNumericValue = 0;

    return filter;
};

/**
 * Creates Partition Input filters that need to be set on the context.
 * *
 * @param {Object} selectedObjects - Newly Selected Partitions in the Tree
 * @param {Object} partitionSchemeObject - Partition Scheme for which Popup is opened
 * @returns {Object} Applied filters that need to be set on the context.
 */
export let createPartitionInputFilters = function( selectedObjects, partitionSchemeObject ) {
    var appliedFilters;
    var searchFilterCategories;
    var searchFilterMap;
    var categoryExist = false;

    // For each selected object, get the uid as the filter.stringValue
    for( var i = 0; i < selectedObjects.length; i++ ) {
        var selObject = selectedObjects[i];
        var filter = getFilterObject( selObject );

        if( appliedFilters && appliedFilters.filterCategories ) {
            searchFilterCategories = appliedFilters.filterCategories[0];
            if( searchFilterCategories ) {
                categoryExist = true;
                searchFilterMap = appliedFilters.filterMap[searchFilterCategories.internalName];

                var filterValueApplied = _.filter( searchFilterMap, function( filterValue ) {
                    return filterValue.stringValue === filter.stringValue;
                } );

                /* if( filterValueApplied && filterValueApplied.length > 0 ) {      //Filter value is applied, so now remove it
                    _.remove( searchFilterMap, function( filterValue ) {
                        return filterValue.stringValue === filter.stringValue;
                    } );

                    //After removing filter value if searchFilterMap is empty then remove the category and filter values from applied filer
                    if( searchFilterMap.length === 0 ) {
                        delete appliedFilters.filterMap[searchFilterCategories.internalName];
                        _.remove( appliedFilters.filterCategories, function( tempCat ) {
                            return tempCat.internalName === searchFilterCategories.internalName;
                        } );

                        //After removing the filterCategory and filterMap entries if appliedFilter is empty then delete the same
                        if( appliedFilters.filterCategories.length === 0 ) {
                            delete appliedFilters.filterMap;
                            delete appliedFilters.filterCategories;
                        }
                    }
                    return;
                }*/
            }
        }

        if( !categoryExist ) {
            //set the search filter category.
            searchFilterCategories = createSearchFilterCategoryForSOA( partitionSchemeObject );
        }
        //set the filter values Map for this category.
        var searchFilterMapObj = createSearchFilterMapForSOA( filter );

        if( !categoryExist ) {
            if( appliedFilters && appliedFilters.filterCategories ) {
                appliedFilters.filterCategories.push( searchFilterCategories );
                appliedFilters.filterMap[searchFilterCategories.internalName] = [ searchFilterMapObj ];
            } else{
                var filterMap = {};
                filterMap[searchFilterCategories.internalName] = [ searchFilterMapObj ];

                appliedFilters = {
                    filterCategories: [ searchFilterCategories ],
                    filterMap: filterMap
                };
            }
        }else{
            searchFilterMap.push( searchFilterMapObj );
        }
    }
    return appliedFilters;
};

let createCriteriaForPartitionFilters = function( filter, partitionScheme ) {
    var criteria = [];

    criteria[0] = partitionScheme.internalName;

    let partitions = filter.filterMap[partitionScheme.internalName];

    for( let i = 0; i < partitions.length; i++ ) {
        criteria.push( partitions[i].stringValue );
    }

    return criteria;
};

let createTransientPartitionDisplayString = function( partitions, partitionScheme ) {
    var displayStr;
    let ptns = partitions.filterMap[partitionScheme.internalName];
    let operator = ':';
    displayStr = partitionScheme.internalName;
    displayStr = displayStr.concat( operator );

    if( ptns.length === 1 ) {
        displayStr = displayStr.concat( ptns[0].stringDisplayValue );
    } else{
        let totalSelectedPtn = ptns.length;
        let totalSelectedPtnStr = totalSelectedPtn.toString().concat( ' Selected' );

        displayStr = displayStr.concat( totalSelectedPtnStr );
    }

    return displayStr;
};

export let updateFiltersInRecipe = ( data, subPanelContext, partitionSchemeObject ) => {
    let selPartitionTreeNodes = data.prevSelectedPartitions;
    var filter = createPartitionInputFilters( selPartitionTreeNodes, partitionSchemeObject );

    var recipeOperator = 'Filter';
    if( subPanelContext.sharedData && subPanelContext.sharedData.recipeOperator ) {
        recipeOperator = subPanelContext.sharedData.recipeOperator;
    }
    var criteriaVal = createCriteriaForPartitionFilters( filter, partitionSchemeObject );
    var displayString = createTransientPartitionDisplayString( filter, partitionSchemeObject );

    var partitionCriteria = {
        criteriaType: 'Partition',
        criteriaOperatorType: recipeOperator,
        criteriaDisplayValue: displayString,
        criteriaValues: criteriaVal,
        subCriteria: []
    };

    //Checking if this is recipe edit.
    var spatialRecipeIndexToUpdate;
    if( subPanelContext.sharedData.recipeTermToAdd ) {
        spatialRecipeIndexToUpdate = subPanelContext.sharedData.spatialRecipeIndexToUpdate;
    }

    occmgmtSubsetUtils.updateSharedDataWithRecipeBeforeNavigate( subPanelContext.activeViewSharedData, subPanelContext.sharedData, partitionCriteria, spatialRecipeIndexToUpdate, 'Awb0DiscoveryFilterCommandSubPanel' );
};

// eslint-disable-next-line require-jsdoc
export function doSelectionOnLaunchOfPartitionPanel( data, subPanelContext ) {
    checkPartitionsInRecipe( data, subPanelContext );
    return data.dataProviders.partitionDataProvider.getSelectedObjects();
}

/**
 * Adds two numbers together.
 * @param {int} num1 The first number.
 * @param {int} num2 The second number.
 * @returns {int} The sum of the two numbers.
 */
export function isSchemePresentInAppliedRecipe( data, subPanelContext ) {
    let schemeDisplayName = subPanelContext.sharedData.clickedObj.selected.label;
    let recipeTerms = subPanelContext.sharedData.recipeTermToAdd;
    var isUpdateOperation = false;

    // Loop through the recipe terms to see if scheme is in the recipe.
    // If yes, then its a recipe update operation else its add operation
    for( let inx = 0; inx < recipeTerms.length; inx++ ) {
        let recipeTerm = recipeTerms[inx];
        if ( recipeTerm.criteriaType === 'Partition' && recipeTerm.criteriaDisplayValue.includes( schemeDisplayName ) ) {
            isUpdateOperation = true;
            break;
        }
    }
    data.dispatch( { path: 'data.isUpdateOperation.dbValue', value: isUpdateOperation } );
}

// eslint-disable-next-line require-jsdoc
export function getAncestorsOfSelectedPartition( data ) {
    let ptnAncestorStr = '';
    let noOfSelectedObj = data.data.eventData.selected;

    let selectedPtn = noOfSelectedObj[noOfSelectedObj.length - 1];
    if( typeof selectedPtn !== 'undefined' ) {
        ptnAncestorStr = selectedPtn.displayName;
        let parentUid = selectedPtn.parentUid;

        while( parentUid !== 'top' ) {
            let ptnSeperator = ' > ';

            let parentVmo = cdm.getObject( parentUid );
            let ptnName = parentVmo.props.awb0ArchetypeRevName.dbValues[0];
            ptnName = ptnName.concat( ptnSeperator );
            ptnAncestorStr = ptnName.concat( ptnAncestorStr );

            // let isParentBomLine = parentVmo.props.awb0Parent.dbValues[0].includes( 'Awb0DesignElement' );
            let isParentBomLine = false;
            if( !isParentBomLine ) {
                parentUid = parentVmo.props.awb0Parent.dbValues[0];
            } else{
                parentUid = 'top';
            }
        }
    }
    data.dispatch( { path: 'data.ptnAncestorString.dbValue', value: ptnAncestorStr } );
}

// eslint-disable-next-line require-jsdoc
export function getPartitionsListOnSearch( data, partitionSchemeObj ) {
    var treeLoadResult = {
        parentNode : '',
        childNodes:'',
        totalChildCount:'',
        startChildNdx : 0,
        searchVMNodes :''

    };

    // If the state is load, this means load was performed before and hence we need to clean up the variables.
    // Mode switched from Load to Search tree.
    if ( data.state.dbValue === 'load' ) {
        // Reset variables
        //data.vmNodes = [];
        //data.newlySelectedPartitions = [];
        // data.unSelectedPartitions = [];
        //data.prevSelectedPartitions = [];
    }

    var matchedFilters = data.categories.searchFilterMap[ partitionSchemeObj.internalName ];
    var newVMNodes = [];

    _.forEach( matchedFilters, function( filter ) {
        var vmNode = {
            displayName: filter.stringDisplayValue,
            uid: filter.stringValue,
            isLeaf: true,
            levelNdx: 0,
            iconURL: 'assets/image/typeDynamicPartition48.svg',
            typeIconURL: 'assets/image/typeDynamicPartition48.svg'
        };
        /*var dpProvider = data.dataProviders.partitionDataProvider.viewModelCollection.loadedVMObjects;
        for( let inx = 0; inx < dpProvider.length; inx++ ) {
            if( vmNode.displayName === dpProvider[inx].cellHeader1 ) {
                vmNode.uid = dpProvider[inx].uid;
                break;
            }
        }*/
        if( vmNode.uid !== '' ) {
            newVMNodes.push( vmNode );
        }
    } );

    treeLoadResult.parentNode = data.treeLoadResult.parentNode;
    treeLoadResult.childNodes = newVMNodes;
    treeLoadResult.totalChildCount = newVMNodes.length;
    treeLoadResult.searchVMNodes = newVMNodes;

    //need to set is it a search or normal load method
    data.dispatch( { path: 'data.state.dbValue', value: 'search' } );

    return {
        treeLoadResult: treeLoadResult
    };
}

// eslint-disable-next-line require-jsdoc
export function tempAction( data, subPanelContext ) {
    var temp = data;
}

export default exports = {
    getPartitionHierarchy,
    getProductContext,
    getParentUid,
    checkPartitionsInRecipe,
    loadTreeTableProperties,
    loadProperties,
    onPartitionSelection,
    updateFiltersInRecipe,
    createPartitionInputFilters,
    doSelectionOnLaunchOfPartitionPanel,
    isSchemePresentInAppliedRecipe,
    getAncestorsOfSelectedPartition,
    getPartitionsListOnSearch,
    tempAction
};

