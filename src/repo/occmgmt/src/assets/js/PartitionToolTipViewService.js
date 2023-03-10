// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/
/*eslint-disable jsx-a11y/anchor-is-valid*/

/**
 * This is a service file for Partition link
 *
 * @module js/PartitionToolTipViewService
 */
var exports = {};

export const awPartitionTooltipRenderFunction = ( props ) => {
    let { ...prop } = props;
    let { filter } = prop;
    return (
        <div>{filter.name}</div>
    );
};

export const tempAction = ( props ) => {
    var temp = props;
};

export default exports = {
    awPartitionTooltipRenderFunction,
    tempAction
};


