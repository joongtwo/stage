// Copyright (c) 2022 Siemens

/**
 * @module js/CadBomColumnArrangeService
 */
import _ from 'lodash';
import declUtils from 'js/declUtils';
import appCtxSvc from 'js/appCtxService';
import actionSvc from 'js/actionService';
import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';

/**
 * Process column arrange settings
 *
 * @param {Object} dataProvider - data provider of grid
 * @param {Object} gridId - grid id
 * @param {Object} gridOptions - grid options
 */
export let processColumnsArrangeSettings = function( dataProvider, gridId, gridOptions ) {
    let cols = _.clone( dataProvider.cols );

    _.remove( cols, function( col ) {
        return col.clientColumn;
    } );

    let grididSetting = {
        name: gridId,
        columnConfigId: dataProvider.columnConfig.columnConfigId,
        objectSetUri: dataProvider.objectSetUri,
        columns: cols,
        useStaticFirstCol: Boolean( gridOptions.useStaticFirstCol ),
        showFirstColumn: true
    };

    if( dataProvider.objectSetUri ) {
        grididSetting.operationType = dataProvider.columnConfig.operationType;
    }

    appCtxSvc.registerCtx( 'ArrangeClientScopeUI', grididSetting );
};

/**
 * Arrange grid columns on reset action.
 * @param {object} declViewModel - Declarative View Model for grid
 * @param {object} dataProvider - Data provider
 * @param {object} colProvider - Column provider
 * @returns {object} Promise
 */
let _arrangeColumnsOnResetAction = function( declViewModel, dataProvider, colProvider ) {
    let evaluationCtx = {
        data: declViewModel,
        ctx: appCtxSvc.ctx
    };
    let resetColumnAction = declViewModel.getAction( colProvider.resetColumnAction );
    if( resetColumnAction ) {
        let inputOpType = resetColumnAction.inputData.getOrResetUiConfigsIn &&
            resetColumnAction.inputData.getOrResetUiConfigsIn[ 0 ] &&
            resetColumnAction.inputData.getOrResetUiConfigsIn[ 0 ].columnConfigQueryInfos[ 0 ] &&
            resetColumnAction.inputData.getOrResetUiConfigsIn[ 0 ].columnConfigQueryInfos[ 0 ].operationType;
        let inputTypesForArrange = dataProvider.columnConfig.typesForArrange;

        let postProcessingResponseFunc = function() {
            let config = dataProvider.resetColumnConfigs[ 0 ];
            let columnConfig = config.columnConfigurations[ 0 ];
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

            dataProvider.columnConfig = columnConfig;
            dataProvider.resetColumnConfigs = null;
        };

        if( resetColumnAction.deps ) {
            return declUtils.loadDependentModule( resetColumnAction.deps ).then(
                function( debModuleObj ) {
                    return actionSvc.executeAction( declViewModel, resetColumnAction, evaluationCtx,
                        debModuleObj ).then( postProcessingResponseFunc );
                } );
        }

        return actionSvc.executeAction( declViewModel, resetColumnAction, evaluationCtx, null ).then(
            postProcessingResponseFunc );
    }
    return null;
};

/**
 * Arrange grid columns on save action.
 * @param {object} declViewModel - Declarative View Model for grid
 * @param {object} eventData - Event data
 * @param {object} dataProvider - Data provider
 * @param {object} colProvider - Column provider
 * @returns {object} Promise
 */
let _arrangeColumnsOnSaveAction = function( declViewModel, eventData, dataProvider, colProvider ) {
    let evaluationCtx = {
        data: declViewModel,
        ctx: appCtxSvc.ctx
    };
    let saveColumnAction = declViewModel.getAction( colProvider.saveColumnAndLoadAction );
    if( saveColumnAction ) {
        let soaColumnInfosMap = {};
        let newColumns = [];
        let index = 100;

        // build a map of columnconfig as value and  propertyName as key
        let propNameToColumns = {};
        _.forEach( dataProvider.columnConfig.columns, function( column ) {
            if( column.propertyName || column.name ) {
                propNameToColumns[ column.propertyName ] = column;
            }
        } );

        // add column which has isTreeNavigation as true in soaColumnInfo
        let treeNavigationColumns = _.filter( dataProvider.columnConfig.columns, { isTreeNavigation: true } );
        let treeNavigationColumnOrder = treeNavigationColumns[ 0 ].columnOrder || index;
        let treeNaviColumnInfo = awColumnSvc.createSoaColumnInfo( treeNavigationColumns[ 0 ], treeNavigationColumnOrder );
        soaColumnInfosMap[ treeNaviColumnInfo.propertyName ] = treeNaviColumnInfo;

        // Find old column from map, clone new column, and update its values
        let column = propNameToColumns[ dataProvider.columnConfig.columns[ 0 ].propertyName ];
        if( column ) {
            newColumns.push( column );
        }

        // Update the column for sending via SOA
        _.forEach( eventData.columns, function( col ) {
            // Before saving, remove the icon column
            if( col.name === 'icon' || col.clientColumn ) {
                return;
            }
            var soaColumnInfo = null;
            if( col.propertyName === treeNaviColumnInfo.propertyName ) {
                soaColumnInfo = awColumnSvc.createSoaColumnInfo( col, treeNaviColumnInfo.columnOrder );
            } else {
                index += 100;
                soaColumnInfo = awColumnSvc.createSoaColumnInfo( col, index );
            }

            delete soaColumnInfo.isFilteringEnabled;
            soaColumnInfosMap[ soaColumnInfo.propertyName ] = soaColumnInfo;

            let column = propNameToColumns[ col.propertyName ];
            if( column ) {
                column.hiddenFlag = col.hiddenFlag;
                column.isFilteringEnabled = col.isFilteringEnabled;
                column.pixelWidth = col.pixelWidth;
                column.sortDirection = col.sortDirection;
                column.sortPriority = col.sortPriority;
                if( col.propertyName === treeNaviColumnInfo.propertyName ) {
                    column.columnOrder = treeNaviColumnInfo.columnOrder;
                } else {
                    column.columnOrder = index;
                }
                newColumns.push( column );
            }
        } );

        let clientColumns = _.filter( dataProvider.columnConfig.columns, { clientColumn: true } );

        if( clientColumns ) {
            newColumns = _.concat( newColumns, clientColumns );
            newColumns = _.sortBy( newColumns, function( column ) { return column.columnOrder; } );
        }
        dataProvider.newColumns = Object.values( soaColumnInfosMap );
        dataProvider.columnConfig.columns = newColumns;

        if( saveColumnAction.deps ) {
            return declUtils.loadDependentModule( saveColumnAction.deps ).then(
                function( debModuleObj ) {
                    return actionSvc.executeAction( declViewModel, saveColumnAction, evaluationCtx,
                        debModuleObj ).then( function() {
                        dataProvider.newColumns = null;
                    } );
                } );
        }

        return actionSvc.executeAction( declViewModel, saveColumnAction, evaluationCtx, null ).then(
            function() {
                dataProvider.newColumns = null;
            } );
    }
    return null;
};

/**
 * Arrange grid columns on reset or save action.
 *
 * @param {object} declViewModel - Declarative View Model for grid
 * @param {object} eventData - Event data
 * @returns {object} Promise
 */
export let arrangeColumns = function( declViewModel, eventData ) {
    let gridToArrange = declViewModel.grids[ eventData.name ];
    if( !gridToArrange ) {
        return AwPromiseService.instance.resolve();
    }

    let dataProvider = declViewModel.dataProviders[ gridToArrange.dataProvider ];
    let colProvider = declViewModel.columnProviders[ gridToArrange.columnProvider ];
    let arrangeType = eventData.arrangeType;

    if( arrangeType === 'reset' && colProvider.resetColumnAction ) {
        dataProvider.resetCollapseCache();
        return _arrangeColumnsOnResetAction( declViewModel, dataProvider, colProvider );
    } else if( colProvider.saveColumnAndLoadAction && ( arrangeType === 'saveColumnAction' || arrangeType === 'saveColumnAndLoadAction' ) ) {
        if( arrangeType === 'saveColumnAndLoadAction' ) {
            dataProvider.resetCollapseCache();
        }
        return _arrangeColumnsOnSaveAction( declViewModel, eventData, dataProvider, colProvider );
    } else if( arrangeType === 'saveAsNewColumnAndLoadAction' ) {
        let saveAsNewColumnAndLoadAction = declViewModel.getAction( colProvider.saveAsNewColumnAndLoadAction );
        // If the action is defined, call custom action
        if( saveAsNewColumnAndLoadAction ) {
            let evaluationCtx = {
                data: declViewModel,
                ctx: appCtxSvc.ctx
            };
            return actionSvc.executeAction( declViewModel, saveAsNewColumnAndLoadAction, evaluationCtx, null );
        }
        eventBus.publish( 'saveNewArrangementDefaultEvent' );
    }
    return AwPromiseService.instance.reject( 'Invalid action specified: ' + arrangeType );
};

/**
 * CAD-BOM Column Arrange service
 */

const exports = {
    processColumnsArrangeSettings,
    arrangeColumns
};

export default exports;
