(function(){

    //pseudo-global variables
    var attrArray = ["total-pop", "percent-below-poverty-level", "median-income", "work-outside-place-of-residence", "non-white-hispanic"];
    var expressed = attrArray[0]; //initial attribute


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

            //add coordinated visualization to the map
            setChart(csvData, colorScale);
        };
    };


    function joinData(daneMunicipalities, csvData){
        //loop through csv to assign each set of csv attribute values to geojson municipality
        for (var i=0; i<csvData.length; i++){
            var csvMuni = csvData[i]; //the current region
            var csvKey = csvMuni.LABEL; //the CSV primary key

            //loop through geojson regions to find correct municipality
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
            });
    };

    //function to create coordinated bar chart
    function setChart(csvData, colorScale){
        //chart frame dimensions
        var chartWidth = window.innerWidth * 0.425,
            chartHeight = 473,
            leftPadding = 25,
            rightPadding = 2,
            topBottomPadding = 5,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topBottomPadding * 2,
            translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

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


        //create a scale to size bars proportionally to frame
        var yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 250000]);

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
            .attr("x", function(d, i){
                return i * (chartInnerWidth / csvData.length) + leftPadding;
            })
            .attr("height", function(d, i){
                return 463 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            .style("fill", function(d){
                return colorScale(d[expressed]);
            });

        var chartTitle = chart.append("text")
            .attr("x", 40)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text("Population of Municipalities in Dane County");


    };



})();
