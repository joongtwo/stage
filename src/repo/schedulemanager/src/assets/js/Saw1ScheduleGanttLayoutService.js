// Copyright (c) 2022 Siemens

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import tableSvc from 'js/published/splmTablePublishedService';


// Defines the map of number of baselines to table row height for 'compact' and 'comfy' modes.
const tableRowHeight = {
    'compact': { 0: tableSvc.HEIGHT_COMPACT_ROW, 1: tableSvc.HEIGHT_COMPACT_ROW, 2: 'LARGE' },
    'comfy': { 0: tableSvc.HEIGHT_ROW, 1: tableSvc.HEIGHT_ROW, 2: 'LARGE' }
};

//  Defines the map of number of baselines to gantt row height for 'compact' and 'comfy' modes.
const ganttRowHeight = {
    'compact': { 0: tableSvc.HEIGHT_COMPACT_ROW + 1, 1: tableSvc.HEIGHT_COMPACT_ROW + 1, 2: tableSvc.HEIGHT_COMPACT_ROW + 1 + 32 },
    'comfy': { 0: tableSvc.HEIGHT_ROW + 1, 1: tableSvc.HEIGHT_ROW + 1, 2: tableSvc.HEIGHT_ROW + 1 + 24 }
};

//  Defines the map of number of baselines to gantt bar height for 'compact' and 'comfy' modes.
const ganttBarHeight = {
    'compact': { 0: 'full', 1: 10, 2: 18 },
    'comfy': { 0: 'full', 1: 10, 2: 18 }
};

export const updateTableRowHeight = ( scheduleTree, scheduleNavigationContext ) => {
    let isGanttChartOn = _.get( appCtxSvc.getCtx( 'preferences.AW_SubLocation_ScheduleNavigationSubLocation_ShowGanttChart' ), '0', 'true' ) !== 'false';
    let nBaselines = scheduleNavigationContext.getValue().baselineUids.length;

    let rowHeight = _.get( tableRowHeight, [ appCtxSvc.ctx.layout, isGanttChartOn ? nBaselines : 0 ], 0 );

    if( scheduleTree.gridOptions.rowHeight !== rowHeight ) {
        scheduleTree.gridOptions.rowHeight = rowHeight;
        eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
    }
};

export const updateGanttRowHeight = ( atomicDataRef ) => {
    const ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    if( !ganttInstance ) {
        return;
    }

    let rowHeight = _.get( ganttRowHeight, [ appCtxSvc.ctx.layout, ganttInstance.baselineUids.length ], 0 );
    let barHeight = _.get( ganttBarHeight, [ appCtxSvc.ctx.layout, ganttInstance.baselineUids.length ], 0 );

    if( ganttInstance.config.row_height !== rowHeight || ganttInstance.config.bar_height !== barHeight ) {
        ganttInstance.config.row_height = rowHeight;
        ganttInstance.config.bar_height = barHeight;
        ganttInstance.render();
    }
};

export default {
    updateTableRowHeight,
    updateGanttRowHeight
};
