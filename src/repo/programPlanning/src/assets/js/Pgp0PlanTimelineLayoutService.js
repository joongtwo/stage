// Copyright (c) 2022 Siemens

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import tableSvc from 'js/published/splmTablePublishedService';

//  Defines the map of number of baselines to gantt row height for 'compact' and 'comfy' modes.
const ganttRowHeight = {
    'compact': { 0: tableSvc.HEIGHT_COMPACT_ROW + 1 },
    'comfy': { 0: tableSvc.HEIGHT_ROW + 1 }
};

//  Defines the map of number of baselines to gantt bar height for 'compact' and 'comfy' modes.
const ganttBarHeight = {
    'compact': { 0: 'full' },
    'comfy': { 0: 'full' }
};

export const updateTimelineRowHeight = ( atomicDataRef ) => {
    const ganttInstance = atomicDataRef.ganttChartState.getAtomicData().ganttInstance;
    if( !ganttInstance ) {
        return;
    }

    let rowHeight = _.get( ganttRowHeight, [ appCtxSvc.ctx.layout, 0 ], 0 );
    let barHeight = _.get( ganttBarHeight, [ appCtxSvc.ctx.layout, 0 ], 0 );

    if( ganttInstance.config.row_height !== rowHeight || ganttInstance.config.bar_height !== barHeight ) {
        ganttInstance.config.row_height = rowHeight;
        ganttInstance.config.bar_height = barHeight;
        ganttInstance.render();
    }
};

export default {
    updateTimelineRowHeight
};
