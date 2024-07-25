# Function to find all descendant processes of a given PID
get_descendants() {
    local pid=$1
    local children=$(pgrep -P $pid)
    for child in $children; do
        echo $child
        get_descendants $child
    done
}

# Function to kill all descendant processes of a given PID
kill_descendants() {
    local pid=$1
    local descendants=$(get_descendants $pid)
    for desc in $descendants; do
        echo "Killing process $desc"
        kill -9 $desc
    done
    echo "Killing parent process $pid"
    kill -9 $pid
}

if [ -z "$1" ]; then
    echo "Usage: $0 <pid>"
    exit 1
fi

kill_descendants $1