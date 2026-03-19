"""Simple placeholder upscaling microservice."""
import argparse
import time

def main():
    parser = argparse.ArgumentParser(description='Video upscale worker stub.')
    parser.add_argument('--input', required=True, help='Path to video input')
    parser.add_argument('--factor', type=int, default=2, help='Upscale factor')
    parser.add_argument('--gpu', action='store_true', help='Use GPU acceleration')
    parser.add_argument('--cpu', action='store_true', help='Force CPU fallback')
    parser.add_argument('--output', help='Destination path for upscaled video')
    args = parser.parse_args()

    destination = args.output or 'Downloads folder'
    print(f"Starting upscale for {args.input} x{args.factor} (gpu={args.gpu}) → {destination}")
    for i in range(5):
        print(f"progress:{(i + 1) * 20}%")
        time.sleep(0.3)
    print(f'done: saved to {destination}')

if __name__ == '__main__':
    main()
