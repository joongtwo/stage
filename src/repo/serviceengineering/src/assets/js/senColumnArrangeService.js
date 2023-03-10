// Copyright (c) 2022 Siemens

/**
 * @module js/senColumnArrangeService
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import actionService from 'js/actionService';
import awColumnSvc from 'js/awColumnService';
import _ from 'lodash';
import declUtils from 'js/declUtils';

/**
 *
 * @param {Object} declViewModel declViewModel
 * @param {Object} eventData eventData
 * @returns {Promise} promise
 */
function arrangeColumns( declViewModel, eventData ) {
    let gridToArrange = declViewModel.grids[ eventData.name ];
    if( !gridToArrange ) {
        return AwPromiseService.instance.resolve();
    }

    let dataProvider = declViewModel.dataProviders[ gridToArrange.dataProvider ];
    let colProvider = declViewModel.columnProviders[ gridToArrange.columnProvider ];
    let arrangeType = eventData.arrangeType;
    '';
    let evaluationCtx = {
        data: declViewModel,
        ctx: appCtxService.ctx
    };

    if( arrangeType === 'reset' && colProvider.resetColumnAction ) {
        return resetColumnArrange( declViewModel, dataProvider, colProvider, evaluationCtx );
    } else if( colProvider.saveColumnAndLoadAction && ( arrangeType === 'saveColumnAction' || arrangeType === 'saveColumnAndLoadAction' ) ) {
        return saveAndLoadColumnArrange( declViewModel, dataProvider, colProvider, eventData, evaluationCtx );
    }
    return AwPromiseService.instance.reject( 'Invalid action specified: ' + arrangeType );
}

/**
 *
 * @param {Object} declViewModel declViewModel
 * @param {Object} dataProvider dataProvider
 * @param {Object} colProvider colProvider
 * @param {Object} eventData eventData
 * @param {Object} evalContext evalContext
 * @returns {Promise} promise
 */
function saveAndLoadColumnArrange( declViewModel, dataProvider, colProvider, eventData, evalContext ) {
    if( eventData.arrangeType === 'saveColumnAndLoadAction' ) {
        dataProvider.resetCollapseCache();
    }
    let saveColumnAction = declViewModel.getAction( colProvider.saveColumnAndLoadAction );
    if( saveColumnAction ) {
        let soaColumnInfosMap = {};
        let newColumns = [];
        let index = 100;

        let propNameToColumns = getPropertyNameToColumnConfig( dataProvider.columnConfig.columns );

        // add column which has isTreeNavigation as true in soaColumnInfo
        let treeNavigationColumn = _.filter( dataProvider.columnConfig.columns, { isTreeNavigation: true } );
        let treeNavigationColumnOrder = treeNavigationColumn.columnOrder || index;
        let treeNaviColumnInfo = awColumnSvc.createSoaColumnInfo( treeNavigationColumn[ 0 ], treeNavigationColumnOrder );
        delete treeNaviColumnInfo.isFilteringEnabled;
        soaColumnInfosMap[ treeNaviColumnInfo.propertyName ] = treeNaviColumnInfo;
        index += 100;

        // Update the column for sending via SOA
        _.forEach( eventData.columns, function( col ) {
            // Before saving, remove the icon column
            if( col.name === 'icon' || col.clientColumn ) {
                return;
            }
            if( index === treeNavigationColumnOrder ) {
                index += 100;
            }

            var soaColumnInfo = null;
            if( col.propertyName === treeNaviColumnInfo.propertyName ) {
                soaColumnInfo = awColumnSvc.createSoaColumnInfo( col, treeNaviColumnInfo.columnOrder );
            } else {
                soaColumnInfo = awColumnSvc.createSoaColumnInfo( col, index );
            }

            delete soaColumnInfo.isFilteringEnabled;

            soaColumnInfosMap[ soaColumnInfo.propertyName ] = soaColumnInfo;

            let column = getUpdatedColumn( propNameToColumns[ col.propertyName ], col, col.propertyName === treeNaviColumnInfo.propertyName ? treeNaviColumnInfo.columnOrder : index );
            if( column ) {
                newColumns.push( column );
            }
            index += 100;
        } );
        let clientColumns = _.filter( dataProvider.columnConfig.columns, { enableColumnHiding: false } );

        if( clientColumns ) {
            newColumns = _.concat( newColumns, clientColumns );
            newColumns = _.sortBy( newColumns, function( column ) { return column.columnOrder; } );
        }
        dataProvider.newColumns = Object.values( soaColumnInfosMap );
        dataProvider.columnConfig.columns = newColumns;

        if( saveColumnAction.deps ) {
            return declUtils.loadDependentModule( saveColumnAction.deps ).then(
                function( debModuleObj ) {
                    return actionService.executeAction( declViewModel, saveColumnAction, evalContext,
                        debModuleObj ).then( function() {
                        postProcessSaveAndLoadFunction( dataProvider );
                        return false;
                    } );
                } );
        }

        return actionService.executeAction( declViewModel, saveColumnAction, evalContext, null ).then(
            function() {
                postProcessSaveAndLoadFunction( dataProvider );
                return false;
            } );
    }
}

/**
 *
 * @param {Object} dataProvider dataProvider
 */
function postProcessSaveAndLoadFunction( dataProvider ) {
    dataProvider.newColumns = null;
    dataProvider.gridContextDispatcher( {
        type: 'COLUMN_CONFIG_UPDATE',
        columnConfig: dataProvider.columnConfig
    } );
}

/**
 *  build a map of columnconfig as value and  propertyName as key
 * @param {Array} columns columns
 * @returns{Object} object
 */
function getPropertyNameToColumnConfig( columns ) {
    let propNameToColumns = {};
    _.forEach( columns, function( column ) {
        if( column.propertyName ) {
            propNameToColumns[ column.propertyName ] = column;
        } else if( column.name ) {
            propNameToColumns[ column.name ] = column;
        }
    } );

    return propNameToColumns;
}

/**
 *
 * @param {Object} exitingColumn exitingColumn
 * @param {Object} newColumn newColumn
 * @param {number} columnOrder columnOrder
 * @returns {Object} updated column
 */
function getUpdatedColumn( exitingColumn, newColumn, columnOrder ) {
    if( exitingColumn ) {
        exitingColumn.hiddenFlag = newColumn.hiddenFlag;
        exitingColumn.isFilteringEnabled = newColumn.isFilteringEnabled;
        exitingColumn.pixelWidth = newColumn.pixelWidth;
        exitingColumn.sortDirection = newColumn.sortDirection;
        exitingColumn.sortPriority = newColumn.sortPriority;
        exitingColumn.columnOrder = columnOrder;
    }
    return exitingColumn;
}

/**
 *
 * @param {Object} declViewModel declViewModel
 * @param {Object} dataProvider dataProvider
 * @param {Object} colProvider colProvider
 * @param {Object} evalContext evalContext
 * @returns {Promise} promise
 */
function resetColumnArrange( declViewModel, dataProvider, colProvider, evalContext ) {
    dataProvider.resetCollapseCache();
    let resetColumnAction = declViewModel.getAction( colProvider.resetColumnAction );
    if( resetColumnAction ) {
        let inputOpType = resetColumnAction.inputData.getOrResetUiConfigsIn &&
            resetColumnAction.inputData.getOrResetUiConfigsIn[ 0 ] &&
            resetColumnAction.inputData.getOrResetUiConfigsIn[ 0 ].columnConfigQueryInfos[ 0 ] &&
            resetColumnAction.inputData.getOrResetUiConfigsIn[ 0 ].columnConfigQueryInfos[ 0 ].operationType;
        let inputTypesForArrange = dataProvider.columnConfig.typesForArrange;

        let postResetFunc = function() {
        //    let config = dataProvider.resetColumnConfigs[ 0 ];
            let columnConfig = dataProvider.columnConfig;
            let columns = columnConfig.columns;
            _.forEach( columns, function( column ) {
                if( column.propDescriptor ) {
                    column.displayName = column.propDescriptor.displayName;
                    column.name = column.propDescriptor.propertyName;
                    column.propertyName = column.propDescriptor.propertyName;
                    column.typeName = column.columnSrcType;
                }
            } );

            if( !columnConfig.operationType ) {
                columnConfig.operationType = inputOpType;
            }
            if( !columnConfig.typesForArrange && inputTypesForArrange ) {
                columnConfig.typesForArrange = inputTypesForArrange;
            }

            let clientColumns = _.filter( dataProvider.columnConfig.columns, { clientColumn: true } );
            if( clientColumns ) {
                columns = _.concat( columns, clientColumns );
                columns = _.sortBy( columns, function( column ) { return column.columnOrder; } );
                columnConfig.columns = columns;
            }

            dataProvider.columnConfig = columnConfig;
            dataProvider.resetColumnConfigs = null;
            dataProvider.gridContextDispatcher( {
                type: 'COLUMN_CONFIG_UPDATE',
                columnConfig: dataProvider.columnConfig
            } );

            return false;
        };

        if( resetColumnAction.deps ) {
            return declUtils.loadDependentModule( resetColumnAction.deps ).then(
                function( debModuleObj ) {
                    return actionService.executeAction( declViewModel, resetColumnAction, evalContext,
                        debModuleObj ).then( postResetFunc );
                } );
        }

        return actionService.executeAction( declViewModel, resetColumnAction, evalContext, null ).then(
            postResetFunc );
    }
    return AwPromiseService.instance.reject( 'Invalid action specified: ' + colProvider.resetColumnAction );
}
export default {
    arrangeColumns
};
