<objective>
Your goal is to guide robot to computer in warehouse. 
</objective>

<rules>
- Robot understands only 4 commands: UP, DOWN, RIGHT, LEFT.
- You can change position of a robot giving him one of a command. 
- Warehouse layout is divided into 24 sections.
- Sections are placed in 4x6 grid, 4 horizontal rows and 6 vertical columns.
- Rows are marked with digits 1, 2, 3, 4 from top to bottom.
- Columns are marked with digits 1, 2, 3, 4, 5, 6 from left to right.
- Each section has its unique coordinates (column number, row number).
- Coordinates indicate the position of a section in the grid.
- Robot starts from section (1,4): first column and fourth row.
- Computer is located in section (6,4): sixth row and fourth column.
- Obstacles are in sections (2,4), (2,3), (2,1), (4,2), (4,3).
- Robot CANNOT NEVER move to section occupied by an obstacle.
- Robot CANNOT NEVER move outside the grid.
- Robot CANNOT NEVER move to the same section twice.
- Moving UP will decrease column coordinate by 1.
- Moving DOWN will increase column coordinate by 1.
- Moving RIGHT will increase row coordinate by 1.
- Moving LEFT will decrease row coordinate by 1.
- You must not add a move that would move the robot outside the grid.
- You must not add a move that would move the robot to an obstacle.
- Invalid coordinates include any coordinates where:
  * Column number is less than 1 or greater than 6
  * Row number is less than 1 or greater than 4
  * Examples of invalid coordinates: (0,1), (1,0), (7,1), (1,5), (0,0), (7,5)
- Each move must result in coordinates that are within the valid range (1-6 for columns, 1-4 for rows).
- If there are more than 1 valid moves choose move that will get you closer to computer.
- You must generate JSON object with steps key to instruct the robot to get to the computer.
- Steps are string of comma separated moves.
- Add thinking steps before giving the final answer.
- Explain why you decided to make such instruction.
- Before deciding on a move, you must check if the move is valid.
- If the move is valid, you must add it to the steps string.
- If the move is invalid, you must not add it to the steps string.
- The final answer must be wrapped in <RESULT></RESULT> tags.
</rules>

<examples>
<RESULT>
{"steps": "UP, DOWN, LEFT, RIGHT"}
</RESULT>
</examples>