// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/
/*eslint-disable jsx-a11y/anchor-is-valid*/

/**
 * This is a service file for spatial link
 *
 * @module js/AwSpatialLinkService
 */
import eventBus from 'js/eventBus';
import { noop } from 'js/declUtils';
var exports = {};


export const awSpatialLinkRenderFunction = ( props ) => {
    let { ...prop } = props;
    let { filter, category } = prop;
    let classLinkBorder = 'sw-aria-border';

    const handleKeyUp = ( event ) =>{
        if( event && event.which === 13 ) {
            openSpatialCategoryPanel();
        }
    };

    const openSpatialCategoryPanel = ( ) => {
        var panelName = filter.internalName + 'SubPanel';
        var categoryLogic = category.excludeCategory ? 'Exclude' : 'Filter';
        //Open the sub panel to set the recipe input
        var eventData = {
            nextActiveView: panelName,
            recipeOperator: categoryLogic
        };
        eventBus.publish( 'awb0.updateDiscoverySharedDataForPanelNavigation', eventData );
    };
    return (
        <a tabIndex={0} className={classLinkBorder} href={noop} onClick={openSpatialCategoryPanel} onKeyUp={handleKeyUp}>{filter.name}</a>

    );
};

export default exports = {
    awSpatialLinkRenderFunction
};
