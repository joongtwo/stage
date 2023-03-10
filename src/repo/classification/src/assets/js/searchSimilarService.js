// Copyright (c) 2022 Siemens

/**
 * This is a service to functions used in Search similar use case.
 *
 * @module js/searchSimilarService
 */
import soaService from 'soa/kernel/soaService';
import classifySvc from 'js/classifyService';
import classifyUtils from 'js/classifyUtils';
import appCtxSvc from 'js/appCtxService';
import commandService from 'js/command.service';
import TcServerVersion from 'js/TcServerVersion';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import localStrg from 'js/localStorage';
import AwStateService from 'js/awStateService';
import AwPromiseService from 'js/awPromiseService';
import awTableSvc from 'js/awTableService';
import awColumnSvc from 'js/awColumnService';
import commandPanelService from 'js/commandPanel.service';
import classifyDefinesService from 'js/classifyDefinesService';

var exports = {};

var _thisScope = {};

/**
 *
 * @param {Object} node Elems that contain the information to build the node from.
 * @param {Number} level level of indent the node should have.
 * @param {Boolean} isLeaf is the last node in the tree.
 * @returns {ViewModeTreeNode} vmNode
 */
let createTreeVmNode = function( node, level, isLeaf ) {
    var vmNode = awTableSvc.createViewModelTreeNode( node.dbValue, '', node.displayValues, level, 0, '' );
    vmNode.isExpanded = true;
    vmNode.isLeaf = isLeaf;
    vmNode.selected = isLeaf;
    return vmNode;
};

/**
 * We are using below function when tree needs to be created.
 * We need to use it for expanding the tree as well.
 * @param {object} treeLoadInput Tree load input
 * @param {object} data Declarative view model
 * @param {string} selectedIco selected ico
 * @return {Promise} Resolved with an object containing the results of the operation.
 */
export let getTreeStructure = function( treeLoadInput, data, selectedIco ) {
    let treeLoadResult;
    let deferred = AwPromiseService.instance.defer();
    if( selectedIco[ 0 ].modelType.parentTypeName === 'Folder' ) {
        // To close the Search Similar panel
        commandPanelService.activateCommandPanel( 'Awp0SearchSimilar', 'aw_toolsAndInfo' );
    } else {
        data.providerName = 'searchSimilarDataProvider';

        if( !treeLoadInput ) {
            return deferred.promise;
        }
        treeLoadInput.pageSize = Number.MAX_SAFE_INTEGER;
        treeLoadInput.retainTreeExpansionStates = false;
        treeLoadInput = awTableSvc.findTreeLoadInput( arguments );
        data.treeLoadInput = treeLoadInput;
        data.treeLoadInput.displayMode = 'Tree';

        let failureReason = awTableSvc.validateTreeLoadInput( treeLoadInput );

        if( failureReason ) {
            deferred.reject( failureReason );

            return deferred.promise;
        }

        let parents = selectedIco[ 0 ].props.parentIds.dbValue;

        // Creates the view model tree nodes
        let finalVMTNodes = parents.map( ( node, index, list ) => createTreeVmNode( node, index, list.length - 1 === index ) );

        treeLoadResult = awTableSvc.buildTreeLoadResult( data.treeLoadInput, finalVMTNodes, false, true, true, null );
    }
    deferred.resolve( {
        treeLoadResult: treeLoadResult
    } );
    return deferred.promise;
};

/**
 * Loads columns for the column
 * @return {object} promise for async call
 */
export let loadColumns = function() {
    var deferred = AwPromiseService.instance.defer();

    var awColumnInfos = [];

    awColumnInfos.push( awColumnSvc.createColumnInfo( {
        name: 'searchSimilar',
        isTreeNavigation: true,
        isTableCommand: false,
        enableSorting: false,
        enableCellEdit: false,
        width: 200,
        minWidth: 200,
        enableColumnResizing: false,
        enableColumnMoving: false,
        enableFiltering: false,
        frozenColumnIndex: -1
    } ) );

    deferred.resolve( {
        columnInfos: awColumnInfos
    } );
    return deferred.promise;
};

/**
 * Load properties to be shown in the tree structure
 * @param {Object} propertyLoadInput - Property Load Input
 * @return {object} promise for async call
 */
export let loadPropertiesJS = function( propertyLoadInput ) {
    var allChildNodes = [];
    var propertyLoadInput = awTableSvc.findPropertyLoadInput( arguments );

    if( propertyLoadInput ) {
        _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
            _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
                if( !childNode.props ) {
                    childNode.props = {};
                }
                if( childNode.id !== classifyDefinesService.ROOT_LEVEL_ID ) {
                    allChildNodes.push( childNode );
                }
            } );
        } );

        var propertyLoadResult = awTableSvc.createPropertyLoadResult( allChildNodes );

        return AwPromiseService.instance.resolve( {
            propertyLoadResult: propertyLoadResult
        } );
    }
};

export let searchSimilarResetToDefault = function( data ) {
    if( appCtxSvc.ctx.SearchSimilarActive ) {
        appCtxSvc.ctx.SearchSimilarActive = false;

        data.bulkFiltersMap = {
            searchResultFilters: []
        };
        var idx;
        _.forEach( data.categories, function( category ) {
            if( appCtxSvc.ctx.searchSimilarAppliedFilter.indexOf( category.internalName ) >= 0 ) {
                var isDateFilter = category.type === 'DateFilter';

                idx = data.bulkFiltersMap.searchResultFilters.push( {
                    searchResultCategory: category.displayName,
                    searchResultCategoryInternalName: category.internalName,
                    filterValues: []
                } );
                _.forEach( category.filterValues, function( filterValue ) {
                    if( filterValue.selected ) {
                        data.bulkFiltersMap.searchResultFilters[ idx - 1 ].filterValues.push( filterValue );
                    } else if( isDateFilter && category.showDateRangeFilter ) {
                        var dateFilerValue = {};
                        var dateValue = category.daterange.startDate.dateApi.dateValue;
                        var dateObject = category.daterange.startDate.dateApi.dateObject;
                        var dateString = dateValue.substring( 7, 11 ) + '-' + classifyUtils.getMonthNumber( dateValue.substring( 3, 6 ) ) + '-' + dateValue.substring( 0, 2 );
                        var timeOffSet = classifyUtils.getTimezoneOffsetInHours( dateObject.getTimezoneOffset() );
                        dateFilerValue.internalName = '_DateFilter_' + dateString + 'T' + '00:00:00' + timeOffSet + '_TO_' + dateString + 'T' + '23:59:59' + timeOffSet;
                        dateFilerValue.isUserInput = true;
                        dateFilerValue.name = dateValue + ' - ' + category.daterange.endDate.dateApi.dateValue;
                        data.bulkFiltersMap.searchResultFilters[ idx - 1 ].filterValues.push( dateFilerValue );
                    }
                } );
            }
        } );
        appCtxSvc.ctx.clsLocation.savedFilters.filters = _.cloneDeep( data.bulkFiltersMap.searchResultFilters );
        appCtxSvc.ctx.clsLocation.bulkFiltersMap = _.cloneDeep( data.bulkFiltersMap );
        appCtxSvc.ctx.clsLocation.isBulkFilterMapDirty = false;
        eventBus.publish( 'updateObjectGrid' );
    }
};

export let getSearchSimilarClasses = function( data ) {
    data.parents = [];
    if( data.eventData && data.eventData.selectedObjects.length > 0 && data.eventData.selectedObjects[ 0 ].cellInternalHeader1 ) {
        data.selectedIcoId = data.eventData.selectedObjects[ 0 ].cellInternalHeader1;
    } else {
        data.selectedIcoId = appCtxSvc.getCtx( 'selectedClassIcoId' );
    }

    var classParents = appCtxSvc.getCtx( 'ICO_response.classParents' );
    var tempParents = [];
    if( data.selectedIcoId && classParents[ data.selectedIcoId ].parents.length > 0 ) {
        _.forEach( classParents[ data.selectedIcoId ].parents, function( parent ) {
            var node = {};
            _.forEach( parent.properties, function( prop ) {
                if( prop.propertyId === 'CLASS_ID' ) {
                    node.id = prop.values[ 0 ].internalValue;
                } else if( prop.propertyId === 'CLASS_NAME' ) {
                    node.className = prop.values[ 0 ].internalValue;
                } else if( prop.propertyId === 'CLASS_TYPE' ) {
                    node.type = prop.values[ 0 ].internalValue;
                } else if( prop.propertyId === 'CLASS_OBJECT_TYPE' ) {
                    node.ObjectType = prop.values[ 0 ].internalValue;
                }
            } );
            tempParents.push( node );
        } );
    }

    for( var i = tempParents.length - 1; i >= 0; i-- ) {
        if( tempParents[ i ].id !== 'SAM' && tempParents[ i ].id !== 'ICM' ) {
            data.parents.push( tempParents[ i ] );
        }
    }
    var classInfo = appCtxSvc.getCtx( 'ICO_response.clsClassDescriptors' );
    var classNode = {};
    if( data.selectedIcoId && classInfo[ data.selectedIcoId ].properties.length > 0 ) {
        _.forEach( classInfo[ data.selectedIcoId ].properties, function( prop ) {
            if( prop.propertyId === 'CLASS_ID' ) {
                classNode.id = prop.values[ 0 ].internalValue;
            } else if( prop.propertyId === 'CLASS_NAME' ) {
                classNode.className = prop.values[ 0 ].internalValue;
            } else if( prop.propertyId === 'CLASS_TYPE' ) {
                classNode.type = prop.values[ 0 ].internalValue;
            } else if( prop.propertyId === 'CLASS_OBJECT_TYPE' ) {
                classNode.ObjectType = prop.values[ 0 ].internalValue;
            }
        } );
    }

    data.parents.push( classNode );
};

export let reloadSearchSimilar = function() {
    eventBus.publish( 'reload.SearchSimilar' );
};

export let setSelectedIco = function( data ) {
    if( data.eventData && data.eventData.selectedObjects.length > 0 && data.eventData.selectedObjects[ 0 ].cellInternalHeader1 ) {
        appCtxSvc.registerCtx( 'selectedClassIcoId', data.eventData.selectedObjects[ 0 ].cellInternalHeader1 );
    } else {
        appCtxSvc.registerCtx( 'selectedClassIcoId', null );
    }

    //when a user selects standAloneICO set to true(just had "Classification Object" selected previously)
    //we make sure to set it to false when they select a Classified object
    var clsLocation = appCtxSvc.getCtx( 'clsLocation' );
    if( clsLocation !== undefined && clsLocation.showStandalone ) {
        clsLocation.showStandalone = false;
    }
};

export let setSearchSimilarMode = function() {
    var stateSvc = AwStateService.instance;
    if( stateSvc.params.mode === 'SearchSimilar' ) {
        appCtxSvc.registerCtx( 'SearchSimilarActive', true );
        commandService.executeCommand( 'Awp0ClassificationSearchNavigate', null, _thisScope );
    }
};

export let getSimilarSearchCriteria = function() {
    var str;
    var classSearchSimilar = localStrg.get( 'SearchSimilarClass' );
    classSearchSimilar = JSON.parse( classSearchSimilar );
    if( !classSearchSimilar.id ) {
        appCtxSvc.ctx.clsLocation.prevSelectedClass = { id: undefined, displayName: '*' };
        return '*';
    }
    appCtxSvc.ctx.clsLocation.selectedTreeNode = { id: classSearchSimilar.id, displayName: classSearchSimilar.className };
    appCtxSvc.ctx.clsLocation.prevSelectedClass = { id: classSearchSimilar.id, displayName: classSearchSimilar.className };
    str = '"Classification Class Id":' + '"' + classSearchSimilar.id + '"';
    return str;
};

export let switchToFilterPanel = function() {
    appCtxSvc.ctx.clsLocation.searchSimilarActiveForTree = true;
    exports.setParentsIds( appCtxSvc.ctx.clsLocation );
    exports.setFocusItem();

    appCtxSvc.ctx.clsLocation.savedFilters = {
        autoUpdateEnabled: true
    };
    appCtxSvc.ctx.clsLocation.isFiltersVisible = true;
    appCtxSvc.ctx.clsLocation.isVncVisible = false;

    eventBus.publish( 'change.SummaryView' );

    eventBus.publish( 'activate.classificationSearchFilters' );

    eventBus.publish( 'primaryWorkarea.reset' );
    appCtxSvc.ctx.clsLocation.isNavigating = true;
};

export let setParentsIds = function( ctx ) {
    var classParents = localStrg.get( 'SearchSimilarParents' );
    ctx.savedBreadCrumbs = JSON.parse( classParents );
};

export let setFocusItem = function() {
    var selectedItem = localStrg.get( 'SearchSimilarItem' );
    appCtxSvc.ctx.clsLocation.searchSimilarFocusItem = JSON.parse( selectedItem );
    appCtxSvc.ctx.clsLocation.focusItemSelected = true;
};

export let unSetFocusItem = function() {
    appCtxSvc.ctx.clsLocation.focusItemSelected = false;
};

export let setCommonFilterMapValues = function( catFilterValuesForSearchSimilar ) {
    catFilterValuesForSearchSimilar.colorValue = '';
    catFilterValuesForSearchSimilar.count = '';
    catFilterValuesForSearchSimilar.selected = false;
    catFilterValuesForSearchSimilar.startEndRange = '';
    catFilterValuesForSearchSimilar.stringDisplayValue = '';
};

export let getFilterMapForSearchSimilar = function() {
    appCtxSvc.ctx.searchSimilarAppliedFilter = [];
    var filterMapForSearchSimilar = {};
    var classSearchSimilar = localStrg.get( 'SearchSimilarClsFilters' );
    classSearchSimilar = JSON.parse( classSearchSimilar );

    for( var key in classSearchSimilar ) {
        var categoryNameForSearchSimilar;

        var tempKey = key;
        if( typeof tempKey === 'string' && tempKey.substring( 0, 4 ) === 'cst0' ) {
            categoryNameForSearchSimilar = classifySvc.CLS_FILTER_KEY + '.' + tempKey.substring( 4 );
        } else {
            if( typeof tempKey === 'string' && tempKey.substring( 0, 4 ) === 'sml0' ) {
                tempKey = parseInt( tempKey.substring( 4 ) );
            }
            categoryNameForSearchSimilar = classifySvc.getFilterCompatibleKey( tempKey );
        }

        var categoriesForSearchSimilar = [];

        if( classSearchSimilar[ key ].formatType === 3 ) {
            var catFilterValuesForSearchSimilar = {};
            exports.setCommonFilterMapValues( catFilterValuesForSearchSimilar );
            var dateValue = classifyUtils.convertClsDateToAWDateWidgetFormat( classSearchSimilar[ key ].values[ 0 ].internalValue, classSearchSimilar[ key ].formatLength, false ).dbValue;
            catFilterValuesForSearchSimilar.endDateValue = dateValue.substring( 0, dateValue.indexOf( 'T' ) ) + 'T' + '23:59:59' + dateValue.substring( 19 );
            catFilterValuesForSearchSimilar.endNumericValue = 0;
            catFilterValuesForSearchSimilar.searchFilterType = 'DateFilter';
            catFilterValuesForSearchSimilar.startDateValue = dateValue.substring( 0, dateValue.indexOf( 'T' ) ) + 'T' + '00:00:00' + dateValue.substring( 19 );
            catFilterValuesForSearchSimilar.startNumericValue = 0;
            catFilterValuesForSearchSimilar.stringValue = '';
            appCtxSvc.ctx.searchSimilarAppliedFilter.push( categoryNameForSearchSimilar );
            categoriesForSearchSimilar.push( catFilterValuesForSearchSimilar );
        } else {
            _.forEach( classSearchSimilar[ key ].values, function( fValue ) {
                var catFilterValuesForSearchSimilar = {};
                exports.setCommonFilterMapValues( catFilterValuesForSearchSimilar );
                catFilterValuesForSearchSimilar.searchFilterType = 'StringFilter';
                catFilterValuesForSearchSimilar.endDateValue = '';
                catFilterValuesForSearchSimilar.startDateValue = '';
                if( classSearchSimilar[ key ].formatType === 0 ) {
                    catFilterValuesForSearchSimilar.endNumericValue = 0;
                    catFilterValuesForSearchSimilar.startNumericValue = 0;
                    catFilterValuesForSearchSimilar.stringValue = fValue.displayValue;
                } else if( classSearchSimilar[ key ].formatType === -1 ) {
                    catFilterValuesForSearchSimilar.endNumericValue = 0;
                    catFilterValuesForSearchSimilar.startNumericValue = 0;
                    for( var lov in classSearchSimilar[ key ].keyLov.keyLOVEntries ) {
                        if( classSearchSimilar[ key ].keyLov.keyLOVEntries[ lov ].keyLOVkey === fValue.internalValue ) {
                            if( classSearchSimilar[ key ].formatLength === -200103 ) {
                                catFilterValuesForSearchSimilar.stringValue = classSearchSimilar[ key ].keyLov.keyLOVEntries[ lov ].keyLOVkey;
                            } else {
                                catFilterValuesForSearchSimilar.stringValue = classSearchSimilar[ key ].keyLov.keyLOVOptions === 1 ? classSearchSimilar[ key ].keyLov.keyLOVEntries[ lov ]
                                    .keyLOVValue : classSearchSimilar[ key ].keyLov.keyLOVEntries[ lov ].keyLOVkey + ' ' + classSearchSimilar[ key ].keyLov.keyLOVEntries[ lov ].keyLOVValue;
                            }
                            break;
                        }
                    }
                } else if( classSearchSimilar[ key ].formatType === 1 ) {
                    catFilterValuesForSearchSimilar.endNumericValue = parseInt( fValue.internalValue );
                    catFilterValuesForSearchSimilar.startNumericValue = parseInt( fValue.internalValue );
                    catFilterValuesForSearchSimilar.stringValue = parseInt( fValue.internalValue ).toString();
                } else if( classSearchSimilar[ key ].formatType === 2 ) {
                    catFilterValuesForSearchSimilar.endNumericValue = parseFloat( fValue.internalValue );
                    catFilterValuesForSearchSimilar.startNumericValue = parseFloat( fValue.internalValue );
                    catFilterValuesForSearchSimilar.stringValue = parseFloat( fValue.internalValue ).toString();
                }
                appCtxSvc.ctx.searchSimilarAppliedFilter.push( categoryNameForSearchSimilar );
                categoriesForSearchSimilar.push( catFilterValuesForSearchSimilar );
            } );
        }

        filterMapForSearchSimilar[ categoryNameForSearchSimilar ] = categoriesForSearchSimilar;
    }

    return filterMapForSearchSimilar;
};

export let clickSearchSimilar = function( dataProvider ) {
    var request;
    const selectedNode = dataProvider.getSelectedObjects()[ 0 ];
    var searchCriteria = {};
    searchCriteria.searchAttribute = classifySvc.UNCT_CLASS_ID;
    if( selectedNode ) {
        searchCriteria.searchString = selectedNode.id;
    }
    searchCriteria.sortOption = classifySvc.UNCT_SORT_OPTION_CLASS_ID;
    request = {
        workspaceObjects: [],
        searchCriterias: [ searchCriteria ],
        classificationDataOptions: classifySvc.loadSearchSimilarConfig
    };

    soaService.post( classifyDefinesService.CLASSIFICATION_SERVICENAME, classifyDefinesService.CLASSIFICATION_OPERATIONNAME, request ).then(
        function( response ) {
            var clsSet = new Set();
            var attributeIdToKeyLovID = new Map();
            if( selectedNode && selectedNode.id ) {
                var isAbstractClass = false;
                for( var classProp in response.clsClassDescriptors[ selectedNode.id ].properties ) {
                    if( response.clsClassDescriptors[ selectedNode.id ].properties[ classProp ].propertyId === 'CLASS_TYPE' ) {
                        if( response.clsClassDescriptors[ selectedNode.id ].properties[ classProp ].values[ 0 ].internalValue === 'AbstractClass' ) {
                            isAbstractClass = true;
                            break;
                        }
                    }
                }
                _.forEach( response.clsClassDescriptors[ selectedNode.id ].attributes, function( appAttr ) {
                    let attributeFormatDef = appAttr.metricFormat?.formatDefinition;
                    if( attributeFormatDef && attributeFormatDef.formatType === -1 ) {
                        attributeIdToKeyLovID.set( appAttr.attributeId, attributeFormatDef.formatLength );
                    }

                    for( var attrProp in appAttr.attributeProperties ) {
                        if( isAbstractClass || appAttr.attributeProperties[ attrProp ].propertyId === 'ATTRIBUTE_SEARCH_SIMILAR' && appAttr.attributeProperties[ attrProp ].values[ 0 ]
                            .internalValue === 'true' ) {
                            clsSet.add( appAttr.attributeId );
                            break;
                        }
                    }
                } );

                //find and add all the block attributes to clsSet
                _.forEach( response.clsBlockDescriptors, function( blocks ) {
                    for( var blockAttr in blocks.attributes ) {
                        let blockAttribute = blocks.attributes[blockAttr];
                        let attributeFormatDef = blockAttribute.metricFormat?.formatDefinition;
                        if( attributeFormatDef && attributeFormatDef.formatType === -1 ) {
                            attributeIdToKeyLovID.set( blockAttribute.attributeId, attributeFormatDef.formatLength );
                        }

                        clsSet.add( blocks.attributes[blockAttr].attributeId );
                    }
                } );
            }

            let filterString = {};
            var classDesc = appCtxSvc.getCtx( 'ICO_response.clsClassDescriptors' );
            var classObjects = appCtxSvc.getCtx( 'ICO_response.clsObjectDefs[1][0].clsObjects' );
            var selectedItem = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
            var keyLOVDescriptors = appCtxSvc.getCtx( 'ICO_response.keyLOVDescriptors' );
            var keySet = new Set();
            for( let key in keyLOVDescriptors ) {
                keySet.add( key );
            }

            var classProps = null;
            _.forEach( classObjects, function( clsObject ) {
                _.forEach( clsObject.properties, function( prop ) {
                    if( selectedNode && prop.propertyId === 'CLASS_ID' && prop.values[ 0 ].internalValue === selectedNode.id ) {
                        classProps = clsObject.properties;
                        return false;
                    }
                } );
                if( classProps ) {
                    return false;
                }
            } );

            //find the block property values of selected object
            var blockProps = {};

            _.forEach( classObjects, function( clsObject ) {
                _.forEach( clsObject.blockDataMap, function( blockDM ) {
                    findAllBlockPropertyValues( blockDM, blockProps );
                } );
            } );

            //Assign key LOVs, format Type and length for all selected block properties
            _.forEach( blockProps, function( prop ) {
                let attributeId = prop.propertyId;
                let keyLovId = attributeId;
                // Attribute Id and attached keylovId can be different
                if( attributeIdToKeyLovID.has( attributeId ) ) {
                    keyLovId = attributeIdToKeyLovID.get( attributeId ).toString();
                }

                if ( keySet.has( keyLovId ) ) {
                    blockProps[attributeId].keyLov = keyLOVDescriptors[keyLovId];
                    blockProps[attributeId].formatType = -1;
                } else if ( keyLovId.substring( 0, 4 ) === 'sml0' || keyLovId.substring( 0, 4 ) === 'cst0' ? keySet.has( keyLovId.substring( 4 ) ) : false ) {
                    blockProps[attributeId].keyLov = keyLOVDescriptors[keyLovId.substring( 4 )];
                    blockProps[attributeId].formatType = -1;
                }

                _.forEach( classDesc[ selectedNode.id ].attributes, function( attr ) {
                    if( attr.attributeProperties[1].propertyId === 'ATTRIBUTE_IS_LAYOUT' && attr.attributeProperties[1].values[0].internalValue === 'True'
                        && attr.attributeId !== '' && response.clsBlockDescriptors[attr.attributeId] ) {
                        _.forEach( response.clsBlockDescriptors[attr.attributeId].attributes, function( intAttr ) {
                            if( intAttr.attributeId === prop.propertyId ) {
                                blockProps[prop.propertyId].formatType = intAttr.metricFormat.formatDefinition.formatType;
                                blockProps[prop.propertyId].formatLength = intAttr.metricFormat.formatDefinition.formatLength;
                                blockProps[prop.propertyId].keyLov = keyLOVDescriptors[intAttr.metricFormat.formatDefinition.formatLength];
                                blockProps[prop.propertyId].arraySize = intAttr.arraySize;
                            }
                        } );
                    }
                } );
            } );

            if( selectedNode && selectedNode.id && classDesc[ selectedNode.id ] && classDesc[ selectedNode.id ].attributes ) {
                _.forEach( classDesc[ selectedNode.id ].attributes, function( attr ) {
                    _.forEach( classProps, function( props ) {
                        if( props.propertyId === 'UNIT_SYSTEM' ) {
                            props.unitSystem = props.values[ 0 ].internalValue;
                        }

                        if( props.propertyId === attr.attributeId ) {
                            if( props.unitSystem === 'nonmetric' ) {
                                props.formatType = attr.nonMetricFormat.formatDefinition.formatType;
                                props.formatLength = attr.nonMetricFormat.formatDefinition.formatLength;
                            } else {
                                props.formatType = attr.metricFormat.formatDefinition.formatType;
                                props.formatLength = attr.metricFormat.formatDefinition.formatLength;
                            }

                            if( props.formatType === -1 ) {
                                let attributeId = props.propertyId;
                                let keyLovId = attributeId;
                                // Attribute Id and attached keylovId can be different
                                if ( attributeIdToKeyLovID.has( attributeId ) ) {
                                    keyLovId = attributeIdToKeyLovID.get( attributeId ).toString();
                                }

                                if ( keySet.has( keyLovId ) ) {
                                    props.keyLov = keyLOVDescriptors[keyLovId];
                                } else if ( keyLovId.substring( 0, 4 ) === 'sml0' || keyLovId.substring( 0, 4 ) === 'cst0' ? keySet.has( keyLovId.substring( 4 ) ) : false ) {
                                    props.keyLov = keyLOVDescriptors[keyLovId.substring( 4 )];
                                } else {
                                    props.keyLov = attr.attributeKeyLOVDef;
                                }
                            }

                            if( props.values.length > 0 && clsSet.has( props.propertyId ) ) {
                                if( props.values.length === 1 && props.values[ 0 ].internalValue.length !== 0 ) {
                                    filterString[ attr.attributeId ] = props;
                                } else if( props.values.length !== 1 ) {
                                    filterString[ attr.attributeId ] = props;
                                }
                            }
                        }
                    } );
                } );
            }

            //add block properties to the filterstring
            _.forEach( blockProps, function( props ) {
                if ( props.values.length > 0 && clsSet.has( props.propertyId ) && props.values.length === 1 &&
                props.values[0].internalValue.length !== 0 || props.values.length !== 1 ) {
                    filterString[ props.propertyId ] = props;
                }
            } );

            localStrg.publish( 'SearchSimilarItem', JSON.stringify( selectedItem ) );
            if( selectedNode ) {
                localStrg.publish( 'SearchSimilarClass', JSON.stringify( selectedNode ) );
            } else {
                localStrg.publish( 'SearchSimilarClass', JSON.stringify( '' ) );
            }
            localStrg.publish( 'SearchSimilarClsFilters', JSON.stringify( filterString ) );
            eventBus.publish( 'open.classificationLocation' );
        } );
};

//find all block property values (nested blocks) of selected object
export let findAllBlockPropertyValues = function( blockDM, blockProps ) {
    _.forEach( blockDM.blocks, function( props ) {
        _.forEach( props.properties, function( prop ) {
            blockProps[prop.propertyId] = prop;
        } );

        if ( props.blockDataMap ) {
            _.forEach( props.blockDataMap, function( blockDM ) {
                findAllBlockPropertyValues( blockDM, blockProps );
            } );
        }
    } );
};

export let openClassificationLocation = function() {
    var currentLocation = window.location;
    var classificationLocation = currentLocation.origin + currentLocation.pathname + '#/showClassification?commandID=Awp0ClassificationSearchNavigate&mode=SearchSimilar';
    window.open( classificationLocation, '_blank', null );
};

export let resetIcoSelection = function() {
    appCtxSvc.registerCtx( 'selectedClassIcoId', null );
};
export let searchSimilarReload = function() {
    eventBus.publish( 'search.similarReload' );
};

export let checkSearchSimilarCommandVisibility = function( majorVersion, minorVersion, qrmNumber ) {
    appCtxSvc.ctx.isSearchSimilarCommandVisible = false;

    //Minimum support is TC12.3
    if( TcServerVersion.majorVersion > 12 || TcServerVersion.majorVersion === 12 && TcServerVersion.minorVersion >= 3 ) {
        appCtxSvc.ctx.isSearchSimilarCommandVisible = true;
        var icoID = appCtxSvc.ctx.selectedClassIcoId;
        if( icoID && appCtxSvc.ctx.ICO_response && appCtxSvc.ctx.ICO_response.clsClassDescriptors ) {
            var classDesc = appCtxSvc.ctx.ICO_response.clsClassDescriptors;
            if( classDesc[ icoID ] ) {
                for( var classProp in classDesc[ icoID ].properties ) {
                    if( classDesc[ icoID ].properties[ classProp ].propertyId === 'CLASS_OBJECT_TYPE' ) {
                        if( classDesc[ icoID ].properties[ classProp ].values[ 0 ].internalValue === 'CST_MASTER_NODE' ) {
                            appCtxSvc.ctx.isSearchSimilarCommandVisible = false;
                            break;
                        }
                    }
                }
            }
        }
    }
};

/**
 * Select last node from search similar tree.
 * @param {object} selectionModel selection model to select last node
 * @param {object} result tree nodes
 */
export let selectLastNode = function( selectionModel, result ) {
    selectionModel.setSelection( result.childNodes[ result.childNodes.length - 1 ] );
};

export default exports = {
    checkSearchSimilarCommandVisibility,
    clickSearchSimilar,
    getFilterMapForSearchSimilar,
    getSearchSimilarClasses,
    getSimilarSearchCriteria,
    getTreeStructure,
    loadColumns,
    loadPropertiesJS,
    openClassificationLocation,
    reloadSearchSimilar,
    resetIcoSelection,
    searchSimilarReload,
    selectLastNode,
    setCommonFilterMapValues,
    setFocusItem,
    setParentsIds,
    setSearchSimilarMode,
    setSelectedIco,
    switchToFilterPanel,
    unSetFocusItem,
    searchSimilarResetToDefault
};
