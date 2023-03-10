// Copyright (c) 2022 Siemens

/**
 * This is a utility to format table with cardianal attribute properties
 *
 * @module js/classifyFullviewTableService
 */
import appCtxSvc from 'js/appCtxService';
import uwPropertyService from 'js/uwPropertyService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import AwPromiseService from 'js/awPromiseService';
import iconSvc from 'js/iconService';
import classifyUtils from 'js/classifyUtils';
import awTableService from 'js/awTableService';
import awColumnService from 'js/awColumnService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

var PROP_COLUMN = 'Property';

/**
 * Creates a column
 * @param {String} propName - prop name
 * @param {String} propDisplayName - prop display name
 * @param {Integer} index - index
 * @param {boolean} editable - true if editable, false otherwise
 * @returns {Object} columnInfo
 */
function _createColumn( propName, propDisplayName, index, editable ) {
    var isTableCommand = false;

    var columnInfo = awColumnService.createColumnInfo();

    /*
     * Set values for common properties
     */
    columnInfo.name = propName;
    columnInfo.propertyName = propName;
    columnInfo.displayName = propDisplayName;
    columnInfo.enableFiltering = true;
    columnInfo.isTableCommand = isTableCommand;
    columnInfo.index = index;
    if( index === 0 ) {
        columnInfo.pinnedLeft = true;
    }

    /**
     * Set values for un-common properties
     */
    columnInfo.typeName = 'String';
    columnInfo.enablePinning = true;
    columnInfo.enableSorting = false;
    columnInfo.enableColumnMenu = false;
    columnInfo.enableCellEdit = true;
    columnInfo.enableColumnMoving = true;
    columnInfo.pixelWidth = 250;

    return columnInfo;
}

/**
 * Returns child cardinal block attribute if found
 * @param {Array} children - children
 * @returns {Object} cardinal attribute
 */
function checkChildrenForCardinality( children ) {
    var cardinalAttr = null;
    if( !children ) {
        return cardinalAttr;
    }
    for( var i = 0; i < children.length; i++ ) {
        var child = children[ i ];
        if( child.cardinalController ) {
            cardinalAttr = child;
            break;
        }
        if( child.type === 'Block' ) {
            cardinalAttr = checkChildrenForCardinality( child.chidren );
        }
    }
    return cardinalAttr;
}

/**
 * Returns cardinal block attribute if found
 * @param {Object} attr - attr
 * @returns {Object} cardinal attribute
 */
function checkBlockForCardinality( attr ) {
    var cardinalAttr = null;

    if( attr.cardinalController ) {
        return attr;
    }

    if( attr.type === 'Block' ) {
        cardinalAttr = checkChildrenForCardinality( attr.children );
    }

    return cardinalAttr;
}

/**
 * Returns cardinal block attribute if found
 * @param {Array} dataGroups - data array
 * @returns {Object} cardinal attribute
 */
export let getCardinalBlock = function( dataGroups ) {
    var cardinalAttr = null;

    if( _.isArray( dataGroups ) ) {
        for( var i = 0; i < dataGroups.length; i++ ) {
            var group = dataGroups[ i ];
            cardinalAttr = checkBlockForCardinality( group );
            if( cardinalAttr ) {
                break;
            }
        }
    } else {
        cardinalAttr = checkBlockForCardinality( dataGroups );
    }
    return cardinalAttr;
};

/**
 * Creates a column
 * @param {Object} data - data
 * @param {Object} attribute - attribute
 * @returns {Object} cardinal attribute
 */
function _getCardinalAttribute( data, attribute ) {
    var cardinalAttr;
    if( attribute ) {
        cardinalAttr = exports.getCardinalBlock( attribute );
    } else {
        if( !data.attr_anno ) {
            return;
        }
        cardinalAttr = exports.getCardinalBlock( data.attr_anno );
    }
    return cardinalAttr;
}

/**
 * Build columns
 *
 * @param {Object} data - data
 * @param {Object} attribute - attribute
 * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
 */
function _buildFlatTableColumnInfos( data, attribute ) {
    var columnInfos = [];

    /**
     * Set 1st column to special 'name' column to support tree-table.
     */
    var propName;
    var propDisplayName;
    var cardinalAttr;

    cardinalAttr = _getCardinalAttribute( data, attribute );

    if( cardinalAttr ) {
        var numOfColumnsIn = cardinalAttr.instances.length;
        propName = PROP_COLUMN;
        propDisplayName = PROP_COLUMN;
        var index = 0;
        var columnInfo = _createColumn( propName, propDisplayName, index, false );
        columnInfos.push( columnInfo );
        var editable = data.editPropInProgress || data.editClassInProgress || data.panelMode === 0 || data.panelMode === 1;
        for( var colNdx = 0; colNdx < numOfColumnsIn; colNdx++ ) {
            propName = cardinalAttr.instances[ colNdx ].name;
            propDisplayName = propName;
            index += 1;
            columnInfo = _createColumn( propName, propDisplayName, index, editable );
            var context = appCtxSvc.getCtx( 'classifyFullscreen' );
            if( numOfColumnsIn < 4 ) {
                columnInfo.pixelWidth = context ? 400 : 250;
            } else {
                columnInfo.pixelWidth = context ? 250 : 150;
            }
            columnInfos.push( columnInfo );
        }
    }
    return columnInfos;
}

/**
 * Returns columns
 *
 * @param {Object} data - data
 * @param {Object} attribute - attribute
 * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 */
function _getFlatTableColumnInfos( data, attribute ) {
    return _buildFlatTableColumnInfos( data, attribute );
}

/**
 * Loads columns
 *
 * @param {Object} data - data
 * @param {Object} dataProvider - data provider
 * @param {Object} columnProvider - column provider
 * @param {Object} attribute - attribute
 * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 */
export let loadColumns = function( data, dataProvider, columnProvider, attribute ) {
    if( !_.isEmpty( attribute ) ) {
        var columns = _getFlatTableColumnInfos( data, attribute );
        dataProvider.columnConfig = {
            columns: columns
        };
        if( data ) {
            data.columnsloaded = true;
        }
        return columns;
    }
};

/**
 * Sets column names/values
 *
 * @param {Object} cardinalAttr - cardinal attribute
 * @param {Object} columnInfo - column info
 * @param {Object} columnNdx - index to column info
 * @param {Object} vmObject - view model object
 * @param {Object} instVmObject - instance view model object
 * @returns {Object} object of values
 */
function _setValues( cardinalAttr, columnInfo, columnNdx, vmObject, instVmObject ) {
    var outValues = {};
    if( columnNdx === 0 ) {
        outValues.dbValue = vmObject.propertyName;
        outValues.displayValues = vmObject.propertyDisplayName;
        outValues.uiValue = outValues.displayValues;
        outValues.dataType = columnInfo.typeName;
    } else {
        if( instVmObject.hasLov ) {
            outValues.dbValue = instVmObject.dbValue;
            outValues.displayValues = instVmObject.displayValues && instVmObject.displayValues.length > 0 ? instVmObject.displayValues : [ '' ];
            outValues.uiValue = instVmObject.uiValue;
        } else {
            var tempOutValues = classifyUtils.getAttributeValuesFromInstance( cardinalAttr, columnNdx, instVmObject.attributeId );
            outValues.dbValue = instVmObject.dbValue && !classifyUtils.isNullOrEmpty( instVmObject.dbValue ) ? instVmObject.dbValue : tempOutValues.dbValue;
            outValues.displayValues = instVmObject.displayValues && !classifyUtils.isNullOrEmpty( instVmObject.displayValues ) ? instVmObject.displayValues : tempOutValues.displayValues;
            outValues.uiValue = outValues.displayValues[ 0 ];
        }
        outValues.isEditable = instVmObject.isEditable;
        outValues.dataType = instVmObject.type;
    }
    return outValues;
}

/**
 * Copy edit props
 * @param {Object} fromVmObject - from object
 * @param {Object} toVmObject - to object
 */
function copyEditProps( fromVmObject, toVmObject ) {
    toVmObject.isEditable = fromVmObject.isEditable;
    toVmObject.editableInViewModel = fromVmObject.isEditable;
    toVmObject.modifiable = fromVmObject.isEditable;
}

/**
 * Copy values from Vmo to another Vmo
 *
 * @param {Object} fromVmo -from vm object
 * @param {Object} toVmo - to vm object
 */
function copyPropValues( fromVmo, toVmo ) {
    if( fromVmo && toVmo ) {
        toVmo.dbValue = fromVmo.dbValue;
        toVmo.uiValue = fromVmo.uiValue;
        copyEditProps( fromVmo, toVmo );
        toVmo.displayValues = fromVmo.displayValues;
    }
}

/**
 * Returns vm property with values
 *
 * @param {Object} cardinalAttr - cardinal attribute
 * @param {Object} columnInfo - column info
 * @param {Object} columnNdx - index to column info
 * @param {Object} vmObject - view model object
 * @param {Object} instVmObject - instance view model object
 * @returns {Object} vm property
 */
function _setVmProp( cardinalAttr, columnInfo, columnNdx, vmObject, instVmObject ) {
    var out = _setValues( cardinalAttr, columnInfo, columnNdx, vmObject, instVmObject );
    var vmProp = uwPropertyService.createViewModelProperty( columnInfo.name, columnInfo.displayName,
        out.dataType, out.dbValue, out.displayValues );
    vmProp.attributeId = vmObject.attributeId;
    vmProp.uiValue = out.uiValue;
    copyEditProps( out, vmProp );
    vmProp.propertyDescriptor = {
        displayName: columnInfo.displayName
    };
    if( columnNdx > 0 ) {
        vmProp.hasLov = instVmObject.hasLov;
        vmProp.lovApi = instVmObject.lovApi;
        vmProp.isRequired = instVmObject.isRequired;
        vmProp.lovNoValsText = instVmObject.lovNoValsText;
    }

    if( columnInfo.isTableCommand ) {
        vmProp.typeIconURL = iconSvc.getTypeIconURL( vmObject.type );
    }
    return vmProp;
}

/**
 * Create vmProp for instance
 * @param {Object} data - declarative view model
 * @param {Object} cardinalAttr - cardinal attribute
 * @param {Object} vmObject - view model object
 * @param {Object} columnInfo - column info
 * @param {Object} columnNdx - index to column info
 * @returns {Object} vm property
 */
function createPolymorphicPropForInstance( data, cardinalAttr, vmObject, columnInfo, columnNdx ) {
    var instance = cardinalAttr.instances[ columnNdx - 1 ];
    var instVmObject = instance.polymorphicTypeProperty.vmps[ 0 ];
    var vmProp = _setVmProp( cardinalAttr, columnInfo, columnNdx, vmObject, instVmObject );

    if( vmProp.hasLov ) {
        if( vmProp.dbValue === null ) {
            if( vmProp.uiValue === '' && !data.assignVisible && data.panelMode !== -1 ) {
                vmProp.uiValue = data.i18n.select;
            }
        }
        // //watch for LOV changes
        // AwRootScopeService.instance.$watch( function() {
        //     return vmProp.dbValue;
        // },
        // function( newValue, oldValue ) {
        //     if( newValue !== oldValue ) {
        //         var kInd = _.findIndex( vmProp.lovApi.klEntries, function( entry ) {
        //             return newValue === entry.propInternalValue;
        //         } );
        //         if( kInd !== -1 ) {
        //             instance.polymorphicTypeProperty.vmps[ 0 ].dbValue = vmProp.dbValue;
        //             var context = {
        //                 owningAttribute: instance,
        //                 cardinalAttribute: cardinalAttr,
        //                 property: instance.polymorphicTypeProperty.vmps
        //             };
        //             eventBus.publish( 'classify.selectLOV', context );
        //         }
        //     }
        // } );
    }
    return vmProp;
}

/**
 * Sets column names/values for cardianal types with polymorphic attributes
 * @param {Object} data -  data
 * @param {Object} cardinalAttr - cardinal attribute
 * @param {Object} columnConfig - column congi
 * @param {Object} vmObject - vm object
 * @returns {ViewModelRowArray} Array of row objects in a 'flat' table (no hierarchy)
 */
function _getRowsForCardInstances( data, cardinalAttr, columnConfig ) {
    var instVmObject;
    var instObject;
    var vmRows = [];
    var rowInd = -1;
    var vmNewObject;
    var vmObject;
    // add rows for instance children
    for( var i = 0; i < cardinalAttr.instances.length; i++ ) {
        instObject = cardinalAttr.instances[ i ];
        if( data.searchResults ) {
            //clean vmRows of children that don't exist. they may vary based on polymorphic selection
            for( var idx = 1; idx < data.searchResults.length; idx++ ) {
                var vmRow = data.searchResults[ idx ];
                //check if row exists for this property
                rowInd = _.findIndex( instObject.children, function( child ) {
                    return child.visible && child.id === vmRow.uid;
                } );
                if( rowInd === -1 && vmRow.props && vmRow.props[ instObject.name ] ) {
                    var clearObj = {};
                    //child object not found, clear values and disable edit
                    copyPropValues( clearObj, vmRow.props[ instObject.name ] );
                }
            }
        }
        //add new rows
        for( var rowNdx = 0; rowNdx < instObject.children.length; rowNdx++ ) {
            var child = instObject.children[ rowNdx ];
            rowInd = -1;
            var found = false;
            if( !child.visible ) {
                continue;
            }
            if( child.type === 'Block' || child.isCardinalControl ) {
                //TBD: ignore nested blocks or cardinal control property for now
                continue;
            }
            if( child.vmps ) {
                vmObject = instObject.children[ rowNdx ].vmps[ 0 ];

                //check if row exists for this property
                rowInd = _.findIndex( vmRows, function( vmRow ) {
                    return vmRow.uid === vmObject.attributeId;
                } );
            }
            var props;
            if( rowInd === -1 ) {
                vmNewObject = tcViewModelObjectService.createViewModelObjectById( vmObject.attributeId );
                var sInd = _.findIndex( data.searchResults, function( vmRow ) {
                    return vmRow.uid === vmObject.attributeId;
                } );
                if( sInd === -1 ) {
                    vmObject.props = [];
                } else {
                    found = true;
                    props = data.searchResults[ sInd ].props;
                    copyEditProps( vmObject, props[ instObject.name ] );
                    props[ instObject.name ].type = vmObject.type;
                    vmObject.props = props;
                }
            } else {
                //use existing row
                vmNewObject = vmRows[ rowInd ];
                props = vmNewObject.props;
                if( props[ instObject.name ] ) {
                    found = true;
                    var prop = props[ instObject.name ];
                    copyEditProps( vmObject, prop );
                    if( prop.valueUpdated === false ) {
                        prop.type = vmObject.type;
                        prop.dbValue = vmObject.dbValue;
                        prop.uiValue = vmObject.uiValue;
                        prop.displayValues = vmObject.displayValues;
                    }
                }
                vmObject.props = props;
            }
            if( !found ) {
                for( var columnNdx = 0; columnNdx < columnConfig.length; columnNdx++ ) {
                    var columnInfo = columnConfig[ columnNdx ];
                    var vmProp;

                    //ignore if row already found or if it is not same instance column
                    if( columnInfo.name !== instObject.name && columnInfo.name !== PROP_COLUMN ) {
                        if( rowInd === -1 ) {
                            instVmObject = _.cloneDeep( vmObject );
                            instVmObject.dbValue = null;
                            instVmObject.displayValues = null;
                            instVmObject.uiValue = null;
                            instVmObject.type = '';
                            vmProp = _setVmProp( cardinalAttr, columnInfo, columnNdx, vmObject, instVmObject );
                            vmObject.props[ columnInfo.name ] = vmProp;
                            continue;
                        }
                        if( rowInd !== -1 ) {
                            continue;
                        }
                    } else {
                        vmProp = _setVmProp( cardinalAttr, columnInfo, columnNdx, vmObject, vmObject );
                        vmObject.props[ columnInfo.name ] = vmProp;
                    }
                }
            }
            vmNewObject.props = vmObject.props;
            if( rowInd > -1 ) {
                vmRows[ rowInd ].props = vmNewObject.props;
            } else {
                vmRows.push( vmNewObject );
            }
        }
    }
    return vmRows;
}

/**
 * Sets column names/values for cardianal types with polymorphic attributes
 * @param {Object} data -  data
 * @param {Object} cardinalAttr - cardinal attribute
 * @returns {ViewModelRowArray} Array of row objects in a 'flat' table (no hierarchy)
 */
function _getCardinalWithPolyRows( data, cardinalAttr ) {
    var vmRows = [];
    var rowInd = -1;
    var vmNewObject;
    var columnConfig = data.dataProviders.PropDataProvider.columnConfig.columns;

    //create polymorphic property row
    var vmObject = cardinalAttr.polymorphicTypeProperty.vmps[ 0 ];
    if( data.searchResults ) {
        //check if row exists for this polymorphic property
        rowInd = _.findIndex( data.searchResults, function( vmRow ) {
            return vmRow.uid === vmObject.attributeId;
        } );
    }

    if( rowInd === -1 ) {
        //create row for polymorphic property
        vmNewObject = tcViewModelObjectService.createViewModelObjectById( vmObject.attributeId );
        vmObject.props = [];
        _.forEach( columnConfig, function( columnInfo, columnNdx ) {
            var vmProp;

            if( columnNdx === 0 ) {
                vmProp = _setVmProp( cardinalAttr, columnInfo, columnNdx, vmObject, null );
                vmProp.attributeId = vmObject.attributeId;
            } else {
                vmProp = createPolymorphicPropForInstance( data, cardinalAttr, vmObject, columnInfo, columnNdx );
            }
            vmObject.props[ columnInfo.name ] = vmProp;
        } );
        vmNewObject.props = vmObject.props;
    } else {
        //use existing row
        vmNewObject = data.searchResults[ rowInd ];
        var props = [];
        _.forEach( columnConfig, function( columnInfo, columnNdx ) {
            if( vmNewObject.props[ columnInfo.name ] ) {
                props[ columnInfo.name ] = vmNewObject.props[ columnInfo.name ];
                if( columnNdx > 0 ) {
                    copyEditProps( vmObject, props[ columnInfo.name ] );
                }
            } else {
                //create new column
                var vmProp = createPolymorphicPropForInstance( data, cardinalAttr, vmObject, columnInfo, columnNdx );
                props[ columnInfo.name ] = vmProp;
            }
        } );
        vmNewObject.props = props;
    }
    vmRows.push( vmNewObject );

    // add rows for instance children
    var childRows = _getRowsForCardInstances( data, cardinalAttr, columnConfig );
    _.forEach( childRows, function( childRow ) {
        vmRows.push( childRow );
    } );
    return vmRows;
}

/**
 * Sets column names/values for cardianal types
 * @param {Object} data -  data
 * @param {Object} cardinalAttr - cardinal attribute
 * @returns {ViewModelRowArray} Array of row objects in a 'flat' table (no hierarchy)
 */
function _getCardinalRows( data, cardinalAttr ) {
    var vmRows = [];
    var columnConfig = data.dataProviders.PropDataProvider.columnConfig.columns;
    // add rows for instance children
    vmRows = _getRowsForCardInstances( data, cardinalAttr, columnConfig );
    return vmRows;
}

/**
 * Sets column names/values for cardianal types
 * @param {Object} data -  data
 * @param {Object} cardinalAttr - cardinal attribute
 * @returns {ViewModelRowArray} Array of row objects in a 'flat' table (no hierarchy)
 */
function _getCardinalTableRows( data, cardinalAttr ) {
    var vmRows = [];

    if( cardinalAttr.polymorphicTypeProperty ) {
        //go thru polymorphic data
        vmRows = _getCardinalWithPolyRows( data, cardinalAttr );
    } else {
        //go thru cardinal children
        vmRows = _getCardinalRows( data, cardinalAttr );
    }
    cardinalAttr.numRows = vmRows.length;
    return vmRows;
}

/**
 * Builds table rows
 *
 * @param {Object} data - data
 * @param {Object} attribute - attribute
 * @returns {ViewModelRowArray} Array of row objects in a 'flat' table (no hierarchy)
 */
function _buildFlatTableRows( data, attribute ) {
    var vmRows = [];
    var cardinalAttr = _getCardinalAttribute( data, attribute );
    if( cardinalAttr ) {
        vmRows = _getCardinalTableRows( data, cardinalAttr );
    }

    return vmRows;
}

/**
 * Updates results
 *
 * @param {Object} data - data
 * @param {Object} dataProvider - data provider
 * @param {Array} vmRows - rows
 * @param {Integer} begIdx - beginning index
 * @param {Integer} endIdx - ending index
 * @param {Integer} searchIdx - search index
 * @param {Boolean} doUpdate - true to update table, false otherwise
 * @returns {ViewModelRowArray} results to load into the table
 */
function _loadResults( data, dataProvider, vmRows, begIdx, endIdx, searchIdx, doUpdate ) {
    var loadResult = awTableService.createTableLoadResult( vmRows.length );

    var beg = begIdx ? begIdx : 0;
    var end = endIdx ? endIdx : vmRows.length;
    var results = vmRows.slice( beg, end );

    loadResult.searchResults = results;
    loadResult.searchIndex = searchIdx;
    loadResult.columnConfig = dataProvider.columnConfig;

    if( doUpdate ) {
        data.searchResults = results;
        data.totalFound = results.length;
        dataProvider.viewModelCollection.setViewModelObjects( results );
    }

    return loadResult;
}

/**
 * Loads table as a flat table
 * @param {Object} data - data
 * @param {Object} dataProvider - data provider
 * @param {Object} deferred - promise
 * @param {Array} vmRows - Array of row objects
 * @param {Integer} pageSizeIn - page size
 */
function _loadFlatTableRows( data, dataProvider, deferred, vmRows, pageSizeIn ) {
    var pageSize = pageSizeIn ? pageSizeIn : 20;

    var searchIndex = 0;

    if( data.searchIndex ) {
        searchIndex = data.searchIndex;
    }

    var begNdx;
    var endNdx;

    if( searchIndex < 0 ) {
        deferred.resolve( _loadResults( data, dataProvider, vmRows, begNdx, endNdx, searchIndex, true ) );
    } else {
        begNdx = searchIndex * pageSize;
        if( begNdx >= vmRows.length ) {
            deferred.resolve( _loadResults( data, dataProvider, vmRows, begNdx, endNdx, searchIndex, true ) );
            return;
        }

        endNdx = begNdx + pageSize;
        if( endNdx > vmRows.length ) {
            endNdx = vmRows.length;
        }

        var nextSearchIndex = searchIndex + 1;

        if( endNdx === vmRows.length ) {
            nextSearchIndex = -1;
        }

        deferred.resolve( _loadResults( data, dataProvider, vmRows, begNdx, endNdx, nextSearchIndex, true ) );
    }
}

/**
 * Loads table as a flat table
 *
 * @param {Object} data - data
 * @param {Object} dataProvider - data provider
 * @param {Object} attrField - attribute
 * @param {Object} classifyState - classifyState
 * @return {Object} promise
 */
export let loadFlatTableData = function( data, dataProvider, attrField, classifyState ) {
    let attribute = attrField.value;
    var _flatTableRows = [];
    var columnInfo;
    var deferred = AwPromiseService.instance.defer();
    if( dataProvider.columnConfig ) {
        columnInfo = dataProvider.columnConfig.columns;
    } else {
        columnInfo = _getFlatTableColumnInfos( data, attribute );
        if( !_.isEmpty( columnInfo ) ) {
            dataProvider.columnConfig = {
                columns: columnInfo
            };
        }
    }
    if( !_.isEmpty( columnInfo ) ) {
        _flatTableRows = _buildFlatTableRows( data, attribute );
        _loadFlatTableRows( data, dataProvider, deferred, _flatTableRows );
    }
    return deferred.promise.then( function() {
        if( classifyState.value.panelMode === 0 || classifyState.value.panelMode === 1 ) {
            dataProvider.viewModelCollection.setViewModelObjects( _flatTableRows );
            exports.setTableEditable( data, dataProvider );
        }
    } );
};

/**
 * Sends event to make it editable
 *
 * @param {Object} data - data
 * @param {Object} attribute - cardinal attribute
 * @param {Object} instance - data provider
 */
export let setPolyRequired = function( data, attribute, instance ) {
    var instVmObject = instance.polymorphicTypeProperty.vmps[ 0 ];
    var index = _.findIndex( data.searchResults, function( prop ) {
        return attribute.polymorphicTypeProperty.id === prop.uid;
    } );
    if( index !== -1 ) {
        var vmProp = data.searchResults[ index ];
        vmProp.props[ instance.name ].propertyRequiredText = instVmObject.propertyRequiredText;
        vmProp.props[ instance.name ].uiValue = instVmObject.uiValue;
        vmProp.props[ instance.name ].uiOriginalValue = instVmObject.uiOriginalValue;
        vmProp.props[ instance.name ].dbValue = instVmObject.dbValue;
    }
};

/**
 * Sends event to make it editable
 *
 * @param {Object} data - data
 * @param {Object} dataProvider - data provider
 */
export let setTableEditable = function( data, dataProvider ) {
    let editContext = {
        state: 'starting',
        dataSource: dataProvider
    };
    eventBus.publish( 'editHandlerStateChange', editContext );
};

/**
 * Sends event to make it editable
 *
 * @param {Object} data - data
 * @param {Object} dataProvider - data provider
 */
export let adjustTableToFullScreen = function( data, dataProvider ) {
    var ctx = appCtxSvc.getCtx( 'classifyTableView' );
    if( ctx && ctx.attribute && ctx.attribute.tableView ) {
        var columnConfig = data.dataProviders.PropDataProvider.columnConfig.columns;
        var context = appCtxSvc.getCtx( 'classifyFullscreen' );

        for( var columnNdx = 0; columnNdx < columnConfig.length; columnNdx++ ) {
            var columnInfo = columnConfig[ columnNdx ];
            //ignore Property column
            if( columnInfo.name !== PROP_COLUMN ) {
                if( columnConfig.length < 4 ) {
                    columnInfo.pixelWidth = context ? 350 : 250;
                } else {
                    columnInfo.pixelWidth = context ? 250 : 150;
                }
            }
        }
        eventBus.publish( 'columnArrange', {
            name: 'gridView',
            arrangeType: 'saveColumnAction',
            columns: columnConfig
        } );
    }
};

/**
 * Refreshes table
 *
 * @param {Object} data - data
 * @param {Object} attribute - attribute
 */
export let refreshTable = function( data, attribute ) {
    var dataProvider = data.dataProviders.PropDataProvider;
    dataProvider.viewModelCollection.setViewModelObjects( data.searchResults );
    exports.setTableEditable( data, dataProvider );
};

/**
 * Updates columns and table data
 *
 * @param {Object} data - data
 * @param {Object} attribute - attribute
 */
export let updateTableData = function( data, attribute ) {
    exports.loadColumns( data, data.dataProviders.PropDataProvider, data.columnProviders.PropColProvider, attribute );
    exports.loadFlatTableData( data, data.dataProviders.PropDataProvider, '', attribute );
    exports.setTableEditable( data, data.dataProviders.PropDataProvider );
};

/**
 * Updates table data
 *
 * @param {Object} data - data
 * @param {Object} attribute - attribute
 */
export let updateTableColumnData = function( data, attribute ) {
    if( data.dataProviders.PropDataProvider ) {
        exports.loadFlatTableData( data, data.dataProviders.PropDataProvider, '', attribute );
        exports.setTableEditable( data, data.dataProviders.PropDataProvider );
    }
};

/**
 * Updates instances with data. From column data to instances if swtiching from tableview, from instance data to column data if switching fromlist view
 *
 * @param {Object} data - data view model
 * @param {Object} attribute - attribute
 */
export let updateInstanceData = function( loadedVmos, attribute ) {
    var rows = loadedVmos;
    _.forEach( rows, function( row, idx ) {
        _.forEach( attribute.instances, function( instance ) {
            var children = instance.children;
            var name = instance.name;
            if( instance.polymorphicTypeProperty ) {
                //find polymorphic property
                var instVmObject = instance.polymorphicTypeProperty.vmps[ 0 ];
                if( instVmObject.attributeId === row.uid ) {
                    if( attribute.tableView ) {
                        copyPropValues( row.props[ name ], instVmObject );
                    } else {
                        copyPropValues( instVmObject, row.props[ name ] );
                    }
                }
            }
            var ind = _.findIndex( children, function( child ) {
                return child.id === row.uid;
            } );
            if( ind !== -1 && row.props[ name ] ) {
                if( attribute.tableView ) {
                    children[ ind ].vmps[ 0 ].dbValue = row.props[ name ].dbValue;
                    children[ ind ].vmps[ 0 ].displayValues = row.props[ name ].displayValues;
                    children[ ind ].vmps[ 0 ].uiValue = row.props[ name ].uiValue;
                } else {
                    row.props[ name ].dbValue = children[ ind ].vmps[ 0 ].dbValue;
                    row.props[ name ].displayValues = children[ ind ].vmps[ 0 ].displayValues;
                    row.props[ name ].uiValue = children[ ind ].vmps[ 0 ].uiValue;
                }
            }
        } );
    } );
};

/**
 * Updates instances with data. From column data to instances if swtiching from tableview, from instance data to column data if switching fromlist view
 *
 * @param {Object} data - data view model
 * @param {Object} attribute - attribute
 */
export let clearInstance = function( data, cardinalAttr, attribute ) {
    var rows = data.searchResults;
    //if parent is cleared, clear all instances. Otherwise selected instance
    var clearAll = cardinalAttr.name === attribute.name;
    if( clearAll ) {
        updateTableColumnData( data, attribute );
        return;
    }
    _.forEach( rows, function( row ) {
        _.forEach( cardinalAttr.instances, function( instance ) {
            if( attribute.name === instance.name || clearAll ) {
                var children = instance.children;
                var name = instance.name;

                var ind = _.findIndex( children, function( child ) {
                    return child.id === row.uid;
                } );
                if( ind !== -1 && row.props[ name ] ) {
                    row.props[ name ].dbValue = children[ ind ].vmps[ 0 ].dbValue;
                    row.props[ name ].displayValues = children[ ind ].vmps[ 0 ].displayValues;
                    row.props[ name ].uiValue = children[ ind ].vmps[ 0 ].uiValue;
                }
            }
        } );
    } );
};

export default exports = {
    getCardinalBlock,
    loadColumns,
    loadFlatTableData,
    setPolyRequired,
    setTableEditable,
    adjustTableToFullScreen,
    refreshTable,
    updateTableData,
    updateTableColumnData,
    updateInstanceData,
    clearInstance
};
