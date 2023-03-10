// Copyright (c) 2022 Siemens

/**
 * @module js/effectivityGroupTableService
 */
import adapterSvc from 'js/adapterService';
import AwPromiseService from 'js/awPromiseService';
import uwPropertyService from 'js/uwPropertyService';
import localeService from 'js/localeService';
import appCtxService from 'js/appCtxService';
import awColumnService from 'js/awColumnService';
import awTableService from 'js/awTableService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import messageService from 'js/messagingService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import popupService from 'js/popupService';
import unitEffConfigration from 'js/endItemUnitEffectivityConfigurationService';

var _childTypes = [ 'ItemRevision' ];
var _uwDataProvider = null;

var exports = {};

export let clearEffGrpTable = function( data ) {
    var length = _uwDataProvider.viewModelCollection.loadedVMObjects.length;
    for( var rowNdx = length - 1; rowNdx > 0; rowNdx-- ) {
        _uwDataProvider.viewModelCollection.loadedVMObjects.pop();
    }

    // Clear the values from first row
    uwPropertyService.setValue( _uwDataProvider.viewModelCollection.loadedVMObjects[ 0 ].props.endItem, '' );
    uwPropertyService.setValue( _uwDataProvider.viewModelCollection.loadedVMObjects[ 0 ].props.units, '' );
    data.nameBox.dbValue = '';
};

export let getEffectivitiesInfo = function(  ) {
    var effectivitiesInfo = [];

    var effRows = _uwDataProvider.viewModelCollection.loadedVMObjects;
    for( var rowNdx = 0; rowNdx < effRows.length - 1; rowNdx++ ) {
        var endItem = effRows[ rowNdx ].props.endItem;
        var unitRange = effRows[ rowNdx ].props.units;

        if( endItem.dbValue && unitRange.dbValue[ 0 ] !== '' ) {
            var endItemObj = adapterSvc.getAdaptedObjectsSync( [ cdm.getObject( endItem.dbValue ) ] )[0];
            let endItemUid = endItemObj.props.items_tag && endItemObj.props.items_tag.dbValues[0] || endItemObj.uid;
            var effectivityInfo = {};
            effectivityInfo.clientId = 'createEffectivities';
            effectivityInfo.endItemComponent = {
                uid:   endItemUid,
                type: 'Item'
            };
            effectivityInfo.decision = 0;
            effectivityInfo.unitRangeText = unitRange.dbValue;

            effectivitiesInfo.push( effectivityInfo );
        }
    }
    return effectivitiesInfo;
};

export let getEffectivitiesInfoForEdit = function() {
    var effectivitiesInfo = [];

    var effRows = _uwDataProvider.viewModelCollection.loadedVMObjects;
    for( var rowNdx = 0; rowNdx < effRows.length - 1; rowNdx++ ) {
        var endItem = effRows[ rowNdx ].props.endItem;
        var unitRange = effRows[ rowNdx ].props.units;

        var unitRangeText = unitRange.dbValue.constructor === Array ? unitRange.dbValue[ 0 ] : unitRange.dbValue;
        var effectivityInfo = {};
        if( endItem.dbValue && unitRangeText !== '' ) {
            var endItemObj = null;
            if( endItem.type === 'OBJECT' ) {
                endItemObj = cdm.getObject( endItem.dbValue );
            }
            effectivityInfo.clientId = 'editEffectivities';
            effectivityInfo.decision = 0;

            if( effRows[ rowNdx ].id.length > 2 ) {
                effectivityInfo.effectivityComponent = {
                    uid: effRows[ rowNdx ].id,
                    type: 'Effectivity'
                };
                effectivityInfo.decision = 1;
            }

            if( endItemObj !== null ) {
                let endItemUid = endItemObj.props.items_tag && endItemObj.props.items_tag.dbValues[0] || endItemObj.uid;
                effectivityInfo.endItemComponent = {
                    uid: endItemUid,
                    type: 'Item'
                };
            }
            effectivityInfo.unitRangeText = unitRange.dbValue;

            effectivitiesInfo.push( effectivityInfo );
        } else if( effRows[ rowNdx ].id.length > 2 && ( endItem.dbValue === '' || unitRange.dbValue === '' ) ) {
            effectivityInfo = {
                clientId : 'editEffectivities',
                effectivityComponent : {
                    uid: effRows[ rowNdx ].id,
                    type: 'Effectivity'
                },
                decision: 2,
                unitRangeText: '',
                endItemComponent: { uid: '', type: 'Item' }
            };
            effectivitiesInfo.push( effectivityInfo );
        }
    }
    return effectivitiesInfo;
};

var _addNewRow = function() {
    var effGrpColumnInfos = [];
    var rowNumber = _uwDataProvider.viewModelCollection.loadedVMObjects.length + 1;
    effGrpColumnInfos = _uwDataProvider.columnConfig.columns;
    var vmRow = new ViewModelRow( rowNumber, _childTypes[ 0 ] );

    var dbValues;
    var displayValues;
    _.forEach( effGrpColumnInfos, function( columnInfo ) {
        dbValues = [ '' ];
        displayValues = [ '' ];

        var vmProp = uwPropertyService.createViewModelProperty( columnInfo.name, columnInfo.displayName, columnInfo.typeName, dbValues, displayValues );

        var constMap = {
            ReferencedTypeName: 'ItemRevision'
        };
        var propApi = {
            showAddObject: false
        };
        vmProp.propertyDescriptor = {
            displayName: columnInfo.displayName,
            constantsMap: constMap
        };
        vmProp.propApi = propApi;
        vmProp.isEditable = true;
        vmProp.editableInViewModel = true;
        vmRow.props[ columnInfo.name ] = vmProp;
        vmRow.editableInViewModel = true;
        vmRow.isModifiable = true;
        vmRow.editableInViewModel = true;

        uwPropertyService.setEditable( vmRow.props[ columnInfo.name ], true );

        uwPropertyService.setEditState( vmRow, true );
    } );
    vmRow.alternateID = new Date().getTime();
    _uwDataProvider.viewModelCollection.loadedVMObjects.push( vmRow );
    return vmRow;
};


export let getEffectivityGroupRevision = function( response ) {
    var newObject = response.output[ 0 ].objects[ 0 ];
    var effItem = cdm.getObject( newObject.uid );
    return cdm.getObject( effItem.props.revision_list.dbValues[ 0 ] );
};

export let appendAndGetExistingGroupEffectivities = function( groupRevision, occContext ) {
    var effGrps = [];

    let egos;
    if( occContext.context && occContext.context.configContext
        && occContext.context.configContext.eg_uids ) {
        egos = { dbValues: occContext.context.configContext.eg_uids };
    } else{
        let productContextInfoModelObject = occContext.productContextInfo;
        egos = productContextInfoModelObject.props.awb0EffectivityGroups;
    }
    var appliedEffGrps = egos;

    if( appliedEffGrps ) {
        effGrps = [ ...appliedEffGrps.dbValues ];
    }

    effGrps.push( groupRevision.uid );
    return effGrps;
};

export let getExistingAndSearchedGroupEffectivities = function( occContext, selectedGroupEffectivities ) {
    var groupEffectivityUidArray = [];
    if( occContext.productContextInfo.props.awb0EffectivityGroups ) {
        groupEffectivityUidArray = _.clone( occContext.productContextInfo.props.awb0EffectivityGroups.dbValues );
    }
    for( var i = 0; i < selectedGroupEffectivities.length; ++i ) {
        // Add to PCI if not present
        var index = groupEffectivityUidArray.indexOf( selectedGroupEffectivities[ i ].uid );
        if( index === -1 ) {
            groupEffectivityUidArray.push( selectedGroupEffectivities[ i ].uid );
        }
    }
    return groupEffectivityUidArray;
};

export let applyConfiguration = function( value, occContext ) {
    occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
    popupService.hide();
};

export let updatePartialCtx = function( path, value ) {
    appCtxService.updatePartialCtx( path, value );
};

/**
    * Sends event to make it editable
    *
    * @param {Object} data - data
    * @param {Object} dataProvider - data provider
    */
export let setTableEditable = function( data, dataProvider ) {
    // splm table event
    var context = {
        state: 'starting',
        dataSource: dataProvider
    };
    eventBus.publish( 'editHandlerStateChange', context );
};

export let loadEffectivityGroupTableData = function( effGroupDataProvider, activeState, nestedNavigationState, message ) {
    var deferred = AwPromiseService.instance.defer();
    var effGrpTableColumns = [];
    effGrpTableColumns = effGroupDataProvider.columnConfig.columns;
    if( !effGrpTableColumns ) {
        effGrpTableColumns = _buildEffGroupTableColumnInfos();
    }

    _checkDuplicateEndItemSelection( nestedNavigationState, message );
    _buildEffectivityGroupTableRows( effGrpTableColumns, activeState, nestedNavigationState.vmRows ).then( effGrpTableRows=>{
        nestedNavigationState.update( { ...nestedNavigationState.getValue(), vmRows: effGrpTableRows } );

        deferred.resolve( _buildTableLoadResult( effGrpTableRows ) );
    }, err=>deferred.reject( err ) );

    return deferred.promise;
};

let _buildTableLoadResult = function( effGrpTableRows ) {
    var loadResult = awTableService.createTableLoadResult( effGrpTableRows.length );
    loadResult.searchResults = effGrpTableRows;
    loadResult.searchIndex = 0;
    loadResult.totalFound = effGrpTableRows.length;
    return loadResult;
};
let createEmptyRow = function( columnInfos, activeState, currentLength ) {
    var rowNumber = currentLength + 1;
    var dbValues;
    var displayValues;
    var type = _childTypes[ 0 ];
    var vmRow = new ViewModelRow( rowNumber, type );
    vmRow.alternateID = rowNumber;
    _.forEach( columnInfos, function( columnInfo ) {
        dbValues = [ '' ];
        displayValues = [ '' ];

        var vmProp = uwPropertyService.createViewModelProperty( columnInfo.name, columnInfo.displayName,
            columnInfo.typeName, dbValues, displayValues );

        var constMap = {
            ReferencedTypeName: 'ItemRevision'
        };

        var propApi = {
            showAddObject: false
        };

        vmProp.propertyDescriptor = {
            displayName: columnInfo.displayName,
            constantsMap: constMap
        };
        vmProp.propApi = propApi;

        vmProp.isEditable = true;
        vmProp.editableInViewModel = true;
        vmRow.props[ columnInfo.name ] = vmProp;
        uwPropertyService.setEditable( vmRow.props[ columnInfo.name ], true );
        uwPropertyService.setEditState( vmRow, true );
    } );
    vmRow.editableInViewModel = true;
    vmRow.isModifiable = true;
    vmRow.editableInViewModel = true;
    vmRow.activeState = activeState;
    return vmRow;
};
var _buildEffectivityGroupTableRows = function( columnInfos, activeState, cachedVmRows ) {
    var vmRows = cachedVmRows || [];
    var deferred = AwPromiseService.instance.defer();
    let isEmptyRowPresent = vmRows.filter( vmr=>( !vmr.props.endItem.dbValue || !vmr.props.endItem.dbValue[0] ) && !vmr.props.units.dbValue[0] ).length !== 0;
    if( isEmptyRowPresent ) {
        deferred.resolve( vmRows );
        return deferred.promise;
    }
    let endItemRevs = vmRows.filter( vmr=>{
        let itemR = cdm.getObject( vmr.props.endItem.dbValue );
        if( itemR && itemR.props.items_tag && itemR.props.items_tag.dbValues[0] ) {
            let item = cdm.getObject( itemR.props.items_tag.dbValues[0] );
            return item && ( !item.props.object_string || !item.props.object_string.dbValues[0] );
        }
        return;
    } ).map( vmr=> {
        let itemR = cdm.getObject( vmr.props.endItem.dbValue );
        return itemR.props.items_tag.dbValues[0];
        //return item.props.object_string.dbValues[0] && itemR.props.items_tag.dbValues[0];
    } );

    if( endItemRevs.length > 0 ) {
        dmSvc.getProperties( endItemRevs, [ 'object_string' ] ).then( ()=>{
            updateEndIRWithEndItem( vmRows );
            let vmRow = createEmptyRow( columnInfos, activeState, vmRows.length );
            vmRows.push( vmRow );
            deferred.resolve( vmRows );
        }, err=>deferred.reject( err ) );
    }else{
        updateEndIRWithEndItem( vmRows );
        let vmRow = createEmptyRow( columnInfos, activeState, vmRows.length );
        vmRows.push( vmRow );
        deferred.resolve( vmRows );
    }
    return deferred.promise;
};
let updateEndIRWithEndItem  = function( vmRows ) {
    vmRows.forEach( vmr=>{
        let vmProp = vmr.props.endItem;
        let endItemOrRev = cdm.getObject( vmProp.dbValue );
        if( endItemOrRev ) {
            let uid = endItemOrRev && endItemOrRev.props.items_tag && endItemOrRev.props.items_tag.dbValues[0] || endItemOrRev.uid;
            uwPropertyService.setValue( vmProp, uid );
            uwPropertyService.setDirty( vmProp, true );
        }
    } );
};
export let loadEffectivityGroupTableDataForEdit = function( data, egoToEdit, activeState, nestedNavigationState, message ) {
    var effGrpTableColumns = [];
    effGrpTableColumns = data.dataProviders.effGroupDataProvider.columnConfig.columns;
    if( !effGrpTableColumns ) {
        effGrpTableColumns = _buildEffGroupTableColumnInfos( );
    }

    var deferred = AwPromiseService.instance.defer();
    if( nestedNavigationState.vmRows && nestedNavigationState.vmRows.length > 0 ) {
        _checkDuplicateEndItemSelection( nestedNavigationState, message );
        _buildEffectivityGroupTableRows( effGrpTableColumns, activeState, nestedNavigationState.vmRows ).then( vmRows=>{
            nestedNavigationState.update( { ...nestedNavigationState.getValue(), vmRows: vmRows } );
            deferred.resolve( _buildTableLoadResult( vmRows ) );
        } );
    }else{
        _buildEffectivityGroupTableRowsForEdit( egoToEdit, deferred, effGrpTableColumns, activeState, nestedNavigationState );
    }

    return deferred.promise;
};

let _checkDuplicateEndItemSelection = function( nestedNavigationState, message ) {
    let selectedItemUid;
    var selectedItemIndex;
    var selectedUIValue;
    var index = 0;
    if( !nestedNavigationState.vmRows ) {
        return;
    }
    nestedNavigationState.vmRows.forEach( vmr=>{
        if ( vmr.selected ) {
            let itemR = cdm.getObject( vmr.props.endItem.dbValue );
            if( itemR && itemR.props.items_tag && itemR.props.items_tag.dbValues[0] ) {
                selectedItemUid = itemR.props.items_tag.dbValues[0];
                selectedUIValue = itemR.props.items_tag.uiValues[0];
            } else {
                selectedItemUid = vmr.props.endItem.dbValue;
                selectedUIValue = vmr.props.endItem.displayValues[0];
            }
            selectedItemIndex = index;
        }
        index++;
    }
    );

    for( var inx = 0; inx < nestedNavigationState.vmRows.length; inx++ ) {
        var endItem;
        if( Array.isArray( nestedNavigationState.vmRows[0].props.endItem.dbValue ) ) {
            endItem = nestedNavigationState.vmRows[inx].props.endItem.dbValue[0];
        } else{
            endItem = nestedNavigationState.vmRows[inx].props.endItem.dbValue;
        }
        if (  nestedNavigationState.vmRows[inx].selected !== true &&  selectedItemUid === endItem ) {
            var messageText = message;
            messageText = messageText.replace( '{0}', selectedUIValue );
            messageService.showError( messageText );
            uwPropertyService.setValue( nestedNavigationState.vmRows[ selectedItemIndex ].props.endItem, '' );
        }
    }
};

var _buildEffectivityGroupTableRowsForEdit = function( egoToEdit, deferred, columnInfos, activeState, nestedNavigationState ) {
    var vmRows = [];

    var grpRevs = [];
    grpRevs.push( egoToEdit.uid );
    dmSvc.getProperties( grpRevs, [ 'Fnd0EffectivityList' ] ).then(
        function() {
            var groupRevs = cdm.getObjects( grpRevs );
            var effectivityList = groupRevs[ 0 ].props.Fnd0EffectivityList;
            if( effectivityList.dbValues.length > 0 ) {
                dmSvc.getProperties( effectivityList.dbValues, [ 'unit_range_text', 'end_item' ] ).then(
                    function() {
                        var effectivities = cdm.getObjects( effectivityList.dbValues );
                        var endItems = [];
                        for( var effIndx = 0; effIndx < effectivities.length; effIndx++ ) {
                            endItems.push( effectivities[ effIndx ].props.end_item.dbValues[ 0 ] );
                        }
                        dmSvc.getProperties( endItems, [ 'revision_list' ] ).then(
                            function() {
                                var rowLength = effectivities.length;

                                for( var rowNdx = 0; rowNdx < rowLength; rowNdx++ ) {
                                    var rowId = effectivityList.dbValues[ rowNdx ];
                                    var dbValues;
                                    var displayValues;
                                    var type = _childTypes[ 0 ];
                                    var vmRow = new ViewModelRow( rowId, type );

                                    var uniRangeText = effectivities[ rowNdx ].props.unit_range_text.uiValues[ 0 ];
                                    var endItem = cdm.getObject( effectivities[ rowNdx ].props.end_item.dbValues[ 0 ] );
                                    vmRow.alternateID = effectivities[ rowNdx ].uid || rowNdx;
                                    vmRow.activeState = activeState;
                                    _.forEach( columnInfos, function( columnInfo, columnNdx ) {
                                        if( columnNdx === 0 ) {
                                            dbValues = uniRangeText;
                                            displayValues = [ uniRangeText ];
                                        } else {
                                            dbValues = [ endItem.uid ]; // Passing end item uid as platform SOA needs item
                                            displayValues = [ endItem.props.object_string.dbValues[ 0 ] ];
                                        }

                                        var vmProp = uwPropertyService.createViewModelProperty( columnInfo.name, columnInfo.displayName,
                                            columnInfo.typeName, dbValues, displayValues );

                                        var constMap = {
                                            ReferencedTypeName: 'ItemRevision'
                                        };

                                        var propApi = {
                                            showAddObject: false
                                        };

                                        vmProp.propertyDescriptor = {
                                            displayName: columnInfo.displayName,
                                            constantsMap: constMap
                                        };
                                        vmProp.propApi = propApi;

                                        vmProp.isEditable = true;
                                        vmProp.editableInViewModel = true;
                                        vmRow.props[ columnInfo.name ] = vmProp;
                                        vmRow.editableInViewModel = true;
                                        vmRow.isModifiable = true;
                                        vmRow.editableInViewModel = true;
                                        uwPropertyService.setEditable( vmRow.props[ columnInfo.name ], true );
                                        uwPropertyService.setEditState( vmRow, true );
                                    } );

                                    vmRows.push( vmRow );
                                }

                                var emptyRow = _addNewRow();
                                emptyRow.activeState = activeState;
                                vmRows.push( emptyRow );

                                var loadResult = awTableService.createTableLoadResult( vmRows.length );

                                loadResult.searchResults = vmRows;
                                loadResult.searchIndex = 0;
                                loadResult.totalFound = vmRows.length;

                                nestedNavigationState.update( { ...nestedNavigationState.value, vmRows: vmRows } );
                                deferred.resolve( loadResult );
                            }
                        );
                    } );
            } else {
                var emptyRow = _addNewRow();
                emptyRow.activeState = activeState;
                vmRows.push( emptyRow );

                var loadResult = awTableService.createTableLoadResult( vmRows.length );

                loadResult.searchResults = vmRows;
                loadResult.searchIndex = 0;
                loadResult.totalFound = vmRows.length;

                nestedNavigationState.update( { ...nestedNavigationState.value, vmRows: vmRows } );
                deferred.resolve( loadResult );
            }
        }
    );
};

/**
    * Instances of this class represent the properties and status of a single row in a flat table.
    *
    * @class ViewModelRow
    * @param {String} rowId - Unique ID for this row within the table.
    * @param {String} type - The type of model object represented by this tree node (i.e. 'Item'
    *            'DocumentRevision', etc.).
    */
var ViewModelRow = function( rowId, type ) {
    this.id = rowId;
    this.type = type;
    this.props = {};
};

export let loadEffectivityTableColumns = function( uwDataProvider ) {
    _uwDataProvider = uwDataProvider;
    var deferred = AwPromiseService.instance.defer();
    var effGrpTableColumns = [];
    effGrpTableColumns = _buildEffGroupTableColumnInfos();
    uwDataProvider.columnConfig = {
        columns: effGrpTableColumns
    };

    deferred.resolve( {
        columnInfos: effGrpTableColumns
    } );

    return deferred.promise;
};

/**
    * Get the localized value from a given key.
    * @param {String} key: The key for which the value needs to be extracted.
    * @return {String} localized string for the input key.
    */
function getLocalizedValueFromKey( key ) {
    var resource = 'OccurrenceManagementConstants';
    var localTextBundle = localeService.getLoadedText( resource );
    return localTextBundle[ key ];
}

/**
    * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
    */
var _buildEffGroupTableColumnInfos = function() {
    var columnInfos = [];
    var numOfColumnsIn = 2;
    for( var colNdx = 0; colNdx < numOfColumnsIn; colNdx++ ) {
        var columnInfo = awColumnService.createColumnInfo();
        if( colNdx === 0 ) {
            columnInfo.name = 'units';
            columnInfo.typeName = 'STRING';
            columnInfo.displayName = getLocalizedValueFromKey( 'units' );
            columnInfo.width = 120;
            columnInfo.pinnedLeft = false;
        } else if( colNdx === 1 ) {
            columnInfo.name = 'endItem';
            columnInfo.typeName = 'OBJECT';
            columnInfo.displayName = getLocalizedValueFromKey( 'endItemMessage' );
            columnInfo.width = 202;
            columnInfo.pinnedLeft = false;
        }
        columnInfo.enableCellEdit = true;
        columnInfo.enableColumnMenu = false;
        columnInfos.push( columnInfo );
    }

    return columnInfos;
};

/**
    * Populate initial data
    *
    * @param {data} data The view model data
    */
export let populateInitialData = function( data ) {
    if( data ) {
        var vmoSize = data.dataProviders.effGroupDataProvider.viewModelCollection.loadedVMObjects.length;
        if( vmoSize > 0 ) {
            for( var vmoIndex = 0; vmoIndex < vmoSize; vmoIndex++ ) {
                var viewModelObj = data.dataProviders.effGroupDataProvider.viewModelCollection.loadedVMObjects[ vmoIndex ];
                if( viewModelObj ) {
                    var units = viewModelObj.props.units;
                    if( units ) {
                        units.isEditable = true;
                        units.isModifiable = true;
                        uwPropertyService.setEditState( units, true );
                    }
                    var endItem = viewModelObj.props.endItem;
                    if( endItem ) {
                        endItem.isEditable = true;
                        endItem.isModifiable = true;
                        endItem.finalReferenceType = 'ItemRevision';
                        uwPropertyService.setEditState( endItem, true );
                    }
                }
            }
        }
    }
};

let getFormattedDate_timezoned = function( date ) {
    date = typeof date === 'number' || typeof date === 'string' ? new Date( date ) : date;
    var MM = date.getMonth() + 1;
    MM = MM < 10 ? '0' + MM : MM;
    var dd = date.getDate();
    dd = dd < 10 ? '0' + dd : dd;
    var hh = date.getHours();
    hh = hh < 10 ? '0' + hh : hh;
    var mm = date.getMinutes();
    mm = mm < 10 ? '0' + mm : mm;
    var ss = date.getSeconds();
    ss = ss < 10 ? '0' + ss : ss;
    return date.getFullYear() + '-' + MM + '-' + dd + 'T' + hh + ':' + mm + ':' + ss + date.toString().slice( 28, 33 );
};

export let getDateRange = function( data ) {
    let result = [];
    if( data ) {
        if ( data.endDateOptions.dbValue === 'UP' || data.endDateOptions.dbValue === 'SO' ) {
            result = [ getFormattedDate_timezoned( data.startDateTime.dbValue ) ];
        } else{
            result = [ getFormattedDate_timezoned( data.startDateTime.dbValue ), getFormattedDate_timezoned( data.endDateTime.dbValue ) ];
        }
    }
    return result;
};

export let getOpenEndedStatus = function( data ) {
    if( data ) {
        if ( data.endDateOptions.dbValue === 'UP' ) {
            return 1;
        } else if( data.endDateOptions.dbValue === 'SO' ) {
            return 2;
        }
        return 0;
    }
};

export let applyDateEffectivityGroups = function( data, selectedGroupEffectivities ) {
    selectedGroupEffectivities = selectedGroupEffectivities.length ? selectedGroupEffectivities : [ selectedGroupEffectivities ];
    let groupEffectivityUidArray = unitEffConfigration.getUnitEffectivityGroupsFromProductContextInfo( data.subPanelContext.occContext );
    for( var i = 0; i < selectedGroupEffectivities.length; ++i ) {
        // Add to PCI if not present
        var index = groupEffectivityUidArray.indexOf( selectedGroupEffectivities[ i ].uid );
        if( index === -1 ) {
            groupEffectivityUidArray.push( selectedGroupEffectivities[ i ].uid );
        }
    }
    return groupEffectivityUidArray;
};

export let updateVmRowsWithNewActiveState = ( vmRows, activeState )=>{
    vmRows && vmRows.forEach( vmRow=>{
        vmRow.activeState = activeState;
    } );
};

export let getEffComponent = ( data )=>{
    var obj = cdm.getObject( data.effectivity );
    return {
        uid: data.effectivity,
        type: obj.type
    };
};

export default exports = {
    clearEffGrpTable,
    getEffectivitiesInfo,
    getEffectivitiesInfoForEdit,
    getEffectivityGroupRevision,
    appendAndGetExistingGroupEffectivities,
    getExistingAndSearchedGroupEffectivities,
    updatePartialCtx,
    setTableEditable,
    loadEffectivityGroupTableData,
    loadEffectivityGroupTableDataForEdit,
    loadEffectivityTableColumns,
    populateInitialData,
    applyConfiguration,
    getDateRange,
    getOpenEndedStatus,
    applyDateEffectivityGroups,
    updateVmRowsWithNewActiveState,
    getEffComponent
};
