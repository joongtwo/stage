// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Service for rendering epBalancingProcessResourceTilesListService
 *
 * @module js/epBalancingProcessResourceTilesListService
 */

import EpBalancingProcessResourceTile from 'viewmodel/EpBalancingProcessResourceTileViewModel';
import epBalancingSelectionService from 'js/epBalancingSelectionService';

/**
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export function epBalancingProcessResourceTilesListRender( props ) {
    return (
        <div className='sw-row w-12'>
            <div className='sw-column w-12'>
                {props.viewModel.processResources.map( item => renderProcessResource( item, props ) )}
            </div>
        </div>
    );
}
const onProcessResourceClick = ( e, item, props ) => {
    e.stopPropagation();
    epBalancingSelectionService.updateStationsListOnProcessResourceSelectionChange( item, props.selectionData, props.vmo );
};
const renderProcessResource = ( item, props ) => {
    return (
        <div className='sw-row aw-widgets-cellListItemContainer aw-widgets-cellListItem' key={item.uid} onKeyPress={e => onProcessResourceClick( e, item, props )} onClick={e => onProcessResourceClick( e, item, props )} role='button' tabIndex='0'>
            <EpBalancingProcessResourceTile vmo={item} max={props.max} selection={props.selectionData}  prs={props.prs}/>
        </div>
    );
};


