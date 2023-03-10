// Copyright (c) 2022 Siemens

import awIconService from 'js/awIconService';
import cdm from 'soa/kernel/clientDataModel';

export const getGridIconTemplate = ( ganttTask ) => {
    let tcObject = cdm.getObject( ganttTask.uid );
    let icon = awIconService.getTypeIconFileUrl( tcObject );
    return '<div class=\'gantt_tree_icon\' style=\'background-image:url(' + icon + '\')></div>';
};

export const getTaskClass = ( ganttTask ) => {
    let task_classes = [];
    task_classes.push( ganttTask.getCssClass() );
    return task_classes.join( ' ' );
};

export const getLinkClass = ( link, timelineInstance ) => {
    var link_classes = [];

    if( timelineInstance.selectedLink === link.id ) {
        link_classes.push( 'selected_link' );
    }

    return link_classes.join( ' ' );
};

export const getTooltipText = ( start, end, ganttTask, ganttInstance ) => {
    return ganttTask.getTooltipText && ganttTask.getTooltipText( start, end, ganttTask, ganttInstance );
};

export const getTaskText = ( start, end, ganttTask, ganttInstance ) => {
    return ganttTask.getTaskText && ganttTask.getTaskText( start, end, ganttTask, ganttInstance );
};

export const getLeftSideText = ( start, end, ganttTask, ganttInstance ) => {
    return ganttTask.getLeftSideText && ganttTask.getLeftSideText( start, end, ganttTask, ganttInstance );
};

export const getRightSideText = ( start, end, ganttTask, ganttInstance ) => {
    return ganttTask.getRightSideText && ganttTask.getRightSideText( start, end, ganttTask, ganttInstance );
};

export default {
    getGridIconTemplate,
    getTaskClass,
    getLinkClass,
    getTooltipText,
    getTaskText,
    getLeftSideText,
    getRightSideText
};
