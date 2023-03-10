// Copyright (c) 2022 Siemens

import appCtxService from 'js/appCtxService';
import tableSvc from 'js/published/splmTablePublishedService';

/**
 * Returns the default Gantt configuration commonly used in Acive Workspace.
 * These can be overridden by the consuming components.
 * Refer to https://docs.dhtmlx.com/gantt/api__refs__gantt_props.html for all supported config properties.
 * @returns gantt properties
 */
export const getDefaultConfiguration = () => {
    let defaultConfig = {
        auto_scheduling: false,
        auto_scheduling_initial: false,
        auto_scheduling_strict: false,
        autoscroll_speed: 0,
        branch_loading: true,
        correct_work_time: false,
        details_on_dblclick: false,
        drag_links: false,
        drag_move: false,
        drag_progress: false,
        drag_resize: false,
        grid_resize: true,
        keyboard_navigation: true,
        keyboard_navigation_cells: true,
        order_branch: false,
        readonly: true,
        round_dnd_dates: false,
        row_height: ( appCtxService.ctx.layout === 'compact' ? tableSvc.HEIGHT_COMPACT_ROW : tableSvc.HEIGHT_ROW ) + 1,
        show_grid: true,
        smart_rendering: true,
        static_background: true,
        work_time: true,
        xml_date: '%Y-%m-%d %H:%i',
        wai_aria_attributes: true
    };
    return defaultConfig;
};

const exports = {
    getDefaultConfiguration
};

export default exports;
