(function(){

    //pseudo-global variables
    var attrArray = ["total-pop", "percent-below-poverty-level", "median-income", "work-outside-place-of-residence", "non-white-hispanic"];
    var expressed = attrArray[0]; //initial attribute
    var yMax = 250000 //an attempt at creating a variable to change each time a new attribute is selected so the y axis of the chart can update its height

    //chart frame dimensions
    var chartWidth = window.innerWidth * 0.425,
        chartHeight = 473,
        leftPadding = 40,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //create a scale to size bars proportionally to frame and for axis
    var yScale = d3.scaleLinear()
        .range([463, 0])
        .domain([0, yMax]);

    //begin script when window loads
    window.onload = setMap();

    //set up choropleth map
    function setMap(){

        // map begins
        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 460;

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        // variable to add background to map, kept just in case, you never know these days
        // var backing = map.append("rect")
        //     .attr("class", "backing")
        //     .attr("width", width)
        //     .attr("height", height)

        //create Albers equal area conic projection centered on Dane County
        var projection = d3.geoAlbers()
            .center([0, 43.07])
            .rotate([89.42, 0, 0])
            .parallels([42.95, 43.24])
            .scale(50000)
            .translate([width / 2, height / 2]);

        var path = d3.geoPath()
            .projection(projection);

        // map ends

        //use Promise.all to parallelize asynchronous data loading
        var promises = [d3.csv("data/dane.csv"),
                        d3.json("data/YaharaLakes.json"),
                        d3.json("data/MunicipalBoundaries.json")
                        ];
        Promise.all(promises).then(callback);

        function callback(data){
            csvData = data[0];
            water = data[1];
            dane = data[2];

            //translate TopoJSONs
            var yaharaLakes = topojson.feature(water, water.objects.YaharaLakes),
                daneMunicipalities = topojson.feature(dane, dane.objects.MunicipalBoundaries).features;

            //join csv data to GeoJSON enumeration units
            daneMunicipalities = joinData(daneMunicipalities, csvData);

            //create the color scale
            var colorScale = makeColorScale(csvData);

            //add enumeration units to the map
            setEnumerationUnits(daneMunicipalities, map, path, colorScale);

            //add Yahara lakes to map
            var lakes = map.append("path")
                .datum(yaharaLakes)
                .attr("class", "lakes")
                .attr("d", path);

            var mapTitle = map.append("text")
                .attr("x", 400)
                .attr("y", 23)
                .attr("class", "mapTitle")
                .text("Distinctions Between the Municipalities of Dane County");


            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            //create dropdown menu
            createDropdown(csvData);
        };
    };


    function joinData(daneMunicipalities, csvData){
        //loop through csv to assign each set of csv attribute values to geojson municipality
        for (var i=0; i<csvData.length; i++){
            var csvMuni = csvData[i]; //the current municipality
            var csvKey = csvMuni.LABEL; //the CSV primary key

            //loop through geojson municipalities to find correct municipality
            for (var a=0; a<daneMunicipalities.length; a++){

                var geojsonProps = daneMunicipalities[a].properties; //the current municipality geojson properties
                var geojsonKey = geojsonProps.LABEL; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){

                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvMuni[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };
            };
        };
        return daneMunicipalities;
    };


    //function to create color scale generator
    function makeColorScale(data){
        var colorClasses = [
            "#045a8d",
            "#2b8cbe",
            "#74a9cf",
            "#bdc9e1",
            "#f1eef6"
        ];

        //create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };

        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });
        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);

        return colorScale;
    };

    // old attempt at doing a scale updater
    // function yScale(data){
    //     var yScale = d3.scaleLinear()
    //         .range([463, 0])
    //         .domain([0, Math.max(data[0])]);
    //
    //     //create vertical axis generator
    //     var yAxis = d3.axisLeft()
    //         .scale(yScale);
    //
    //     //place axis
    //     var axis = chart.append("g")
    //         .attr("class", "axis")
    //         .attr("transform", translate)
    //         .call(yAxis);
    // };

    function setEnumerationUnits(daneMunicipalities, map, path, colorScale){
        //add Dane County municipalities to map
        var municipalities = map.selectAll(".municipalities")
            .data(daneMunicipalities)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "municipalities " + d.properties.MCD_NAME;
            })
            .attr("d", path)
            .style("fill", function(d){
                var value = d.properties[expressed];
                if(value) {
                    return colorScale(d.properties[expressed]);
                } else {
                    return "#535353";
                }
            })
            .on("mouseover", function(event, d){
                highlight(d.properties);
            })
            .on("mouseout", function(event, d){
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);

        var desc = municipalities.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    };

    //function to create coordinated bar chart
    function setChart(csvData, colorScale){

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        // create a scale to size bars proportionally to frame
        var yScale = d3.scaleLinear()
            .range([450, 0])
            .domain([0, yMax]);

        //create vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale);

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);

        //set bars for each province
        var bars = chart.selectAll(".bar")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return b[expressed]-a[expressed]
            })
            .attr("class", function(d){
                return "bar " + d.LABEL;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .on("mouseover", function(event, d){
                highlight(d);
            })
            .on("mouseover", function(event, d){
                dehighlight(d);
            })
            .on("mousemove", moveLabel);

            //set bar positions, heights, and colors
            updateChart(bars, csvData.length, colorScale);

        //create chart title
        var chartTitle = chart.append("text")
            .attr("x", 80)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text("Total Population");

        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');

    };

    //function to position, size, and color bars in chart
    function updateChart(bars, n, colorScale, attrArray){
        //position bars
        bars.attr("x", function(d, i){
                return i * (chartInnerWidth / n) + leftPadding;
            })
            //size/resize bars
            .attr("height", function(d, i){
                return 463 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function(d){
                var value = d[expressed];
                if(value) {
                    return colorScale(value);
                } else {
                    return "#ccc";
                }
            });

        //change titles, failed yMax experiment
        var chartTitle = d3.select(".chartTitle")
            if (expressed[0] == "t") {
                chartTitle.text("Total Population")
                // yMax == 250000;
            } else if (expressed[0] == "p") {
                chartTitle.text("Percent of Residents under the Poverty Level")
                // yMax == 50;
            } else if (expressed[0] == "m") {
                chartTitle.text("Median Income")
                // yMax == 150000;
            } else if (expressed[0] == "w") {
                chartTitle.text("Percent of Employed Residents Working in a Different Municipality")
                // yMax == 100;
            } else {
                chartTitle.text("Percent of Non-White and Hispanic Residents")
                // yMax == 50;
            };

        // change yMax (max height of y axis) depending on variable
        // if (attrArray == 0) {
        //     yMax == 250000;
        // } else if (attrArray == 1) {
        //     yMax == 50;
        // } else if (attrArray == 2) {
        //     yMax == 150000;
        // } else if (attrArray == 3) {
        //     yMax == 100;
        // } else {
        //     yMax == 50;
        // };
    };


    // ON USER SELECTION:
    // Step 1. Change the expressed attribute
    // Step 2. Recreate the color scale with new class breaks
    // Step 3. Recolor each enumeration unit on the map
    // Step 4. Re-sort each bar on the bar chart
    // Step 5. Resize each bar on the bar chart
    // Step 6. Recolor each bar on the bar chart
    // Step 7. Recalculate scale on the bar chart

    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData){
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData)
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Select Attribute");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });
    };

    //dropdown change listener handler
    function changeAttribute(attribute, csvData){
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //animate map
        var municipalities = d3.selectAll(".municipalities")
            .transition()
            .duration(1000)
            .style("fill", function(d){
                var value = d.properties[expressed];
                if(value) {
                    return colorScale(value);
                } else {
                    return "#535353";
                }
            });

        //resort and animate bar ch
        var bars = d3.selectAll(".bar")
            //re-sort bars
            .sort(function(a, b){
                return b[expressed] - a[expressed];
            })
            .transition() //add animation
            .delay(function(d, i){
                return i * 20
            })
            .duration(500);

        updateChart(bars, csvData.length, colorScale);
    };

    //function to highlight enumeration units and bars
    function highlight(props){
        //change stroke
        var selected = d3.selectAll("." + props.LABEL)
            .style("stroke", "blue")
            .style("stroke-width", "2");
        var desc = municipalities.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    };

    //function to reset the element style on mouseout
    function dehighlight(props){
        var selected = d3.selectAll("." + props.LABEL)
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });

        function getStyle(element, styleName){
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        };

        d3.select(".infolabel")
            .remove();
    };

    //function to create dynamic label
    function setLabel(props){
        //label content
        var labelAttribute = "<h1>" + props[expressed] +
            "</h1><b>" + expressed + "</b>";

        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.LABEL + "_label")
            .html(labelAttribute);

        var Name = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.name);
    };

    //function to move info label with mouse
    function moveLabel(){
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;

        //use coordinates of mousemove event to set label coordinates
        var x1 = event.clientX + 10,
            y1 = event.clientY - 75,
            x2 = event.clientX - labelWidth - 10,
            y2 = event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
        //vertical label coordinate, testing for overflow
        var y = event.clientY < 75 ? y2 : y1;

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };

})();
