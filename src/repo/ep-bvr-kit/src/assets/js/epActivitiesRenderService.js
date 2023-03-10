// Copyright (c) 2022 Siemens

/**
 * EP Activities service
 *
 * @module js/epActivitiesRenderService
 */

/**
 *
 * @param {Object} vmo  view model object
 * @param {Element} containerElem prent element
 */
function renderActivityCategory( vmo, containerElem ) {
    const category = vmo.props.al_activity_time_system_category.dbValue;
    const categoryElement = document.createElement( 'div' );
    containerElem.title = category;
    containerElem.append( categoryElement );
    let className = '';
    switch ( category ) {
        case 'NA':
            className = 'aw-epActivities-categoryWidgetNa';
            break;
        case 'VA':
            className = 'aw-epActivities-categoryWidgetVa';
            break;
        case 'NVA':
            className = 'aw-epActivities-categoryWidgetNva';
            break;
        case 'NVABR':
            className = 'aw-epActivities-categoryWidgetNvabr';
            break;
    }
    categoryElement.className = className;
}

export default {
    renderActivityCategory
};
