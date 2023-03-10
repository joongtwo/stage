// Copyright (c) 2022 Siemens

import appCtxSvc from 'js/appCtxService';

export const initOverrideVariables = ( ganttInstance ) => {
    ganttInstance[ 'showEventProperties' ] = appCtxSvc.getCtx( 'showEventProperties' );
};

export let addTimelineOverrides = function( timelineInstance ) {
    timelineInstance.$data.tasksStore._isSplitItem = ( task ) => {
        return 'split' === task.render;
    };
    timelineInstance.isLinkAllowed = ( from, fromStart, to, toStart ) => {
        // if( from.source && from.target ) {
        //     return timelineDataSource.checkDuplicateDependency( from.source, from.target );
        // }
        return true;
    };
};

export default {
    initOverrideVariables,
    addTimelineOverrides
};
